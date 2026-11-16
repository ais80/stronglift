// sync.js — keeps this device and a Google Sheet in step, so clearing the phone's
// storage (or a new phone) never loses anything. The sheet runs a small Apps Script
// web app (google-sheets/Code.gs) that stores the whole state as JSON plus readable
// Workouts/Progress tabs and recent snapshots.
//
// Every sync is pull -> merge -> push: read the sheet's copy, merge it with this
// device's (state.mergeStates: histories are unioned, the newer side wins the rest),
// save the result here, then write it back. It runs when the app opens, when it comes
// back to the front, a couple of seconds after any change, and on reconnecting. Nothing
// is ever pushed without pulling first, so a freshly wiped phone can't overwrite the
// sheet with an empty 20kg state.
//
// The sync link lives under its own localStorage key, outside the app state, and is
// the one thing to keep somewhere safe: paste it back in after a wipe and everything
// comes back.
import { load, save, mergeStates } from "./state.js";

const LINK_KEY = "stronglift.sheets.link";
const DIRTY_KEY = "stronglift.sheets.dirty"; // a local change hasn't reached the sheet yet
const LAST_KEY = "stronglift.sheets.last"; // when the last sync succeeded
const PUSH_DELAY_MS = 2000;
const RETRY_MS = 60 * 1000;

let inFlight = null;
let pushTimer = null;
const statusListeners = new Set();

function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function setItem(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    /* ignore */
  }
}

export function getLink() {
  return getItem(LINK_KEY) || "";
}

/** Save the sync link (the Apps Script web app URL ending ?key=...). Empty turns sync off. */
export function setLink(link) {
  setItem(LINK_KEY, (link || "").trim() || null);
}

export function lastSyncedAt() {
  return Number(getItem(LAST_KEY)) || 0;
}

export function hasUnsynced() {
  return !!getItem(DIRTY_KEY);
}

/** `cb(status)` with { state: 'syncing'|'ok'|'error'|'off', message?, at? }. */
export function onStatus(cb) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}
function emit(status) {
  statusListeners.forEach((cb) => cb(status));
}

function withAction(link, action) {
  const url = new URL(link);
  url.searchParams.set("action", action);
  return url.toString();
}

async function call(link, action, body) {
  // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
  const res = await fetch(withAction(link, action), body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    // A Google sign-in page instead of JSON: the web app isn't deployed for "Anyone".
    throw new Error("The sheet didn't answer with data. Check it's deployed with access: Anyone.");
  }
  if (!data.ok) throw new Error(data.error || "The sheet refused the request.");
  return data;
}

/** The state minus sync bookkeeping, for "did the merge change anything visible?" */
function shown(state) {
  return JSON.stringify({ ...state, updatedAt: 0, syncedBaseAt: 0 });
}

/**
 * Pull, merge, push. Resolves { ok, changed } — `changed` is true when the sheet's copy
 * changed what this device shows — or { ok: false, error }. Never throws.
 */
export function syncNow() {
  const link = getLink();
  if (!link) {
    emit({ state: "off" });
    return Promise.resolve({ ok: false, error: "Sync isn't set up." });
  }
  if (inFlight) return inFlight;
  emit({ state: "syncing" });
  inFlight = (async () => {
    try {
      const local = load();
      const { state: remote } = await call(link, "get");
      let merged;
      if (remote) {
        merged = mergeStates(local, remote);
      } else {
        // Empty sheet: this device's data becomes the first copy.
        merged = { ...local, syncedBaseAt: local.updatedAt };
      }
      const changed = shown(merged) !== shown(local);
      save(merged, { touch: false });
      setItem(DIRTY_KEY, null);
      if (!remote || JSON.stringify(remote) !== JSON.stringify(merged)) await call(link, "put", merged);
      setItem(LAST_KEY, String(Date.now()));
      emit({ state: "ok", at: Date.now() });
      return { ok: true, changed };
    } catch (e) {
      emit({ state: "error", message: e.message });
      return { ok: false, error: e.message };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Mark a local change and push it shortly (batches quick successive edits). */
export function schedulePush() {
  setItem(DIRTY_KEY, String(Date.now()));
  if (!getLink()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncNow().then(notifyChanged), PUSH_DELAY_MS);
}

let onRemoteChange = null;
function notifyChanged(result) {
  if (result && result.ok && result.changed && onRemoteChange) onRemoteChange();
}

/**
 * Start syncing: now, whenever the app comes back to the front or the network returns,
 * and every minute while something is waiting. `onChanged` runs when the sheet's copy
 * changed what's on screen.
 */
export function startAutoSync(onChanged) {
  onRemoteChange = onChanged;
  const attempt = () => syncNow().then(notifyChanged);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") attempt();
  });
  window.addEventListener("online", attempt);
  setInterval(() => {
    if (document.visibilityState === "visible" && hasUnsynced()) attempt();
  }, RETRY_MS);
}
