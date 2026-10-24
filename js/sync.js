// sync.js — talks to the T620 backup server (see server/README.md). Same shape as the
// Settings screen's existing file Export/Import, just over the network instead of a
// downloaded file: PUT the whole exported state, GET it back to restore.
import { exportJSON, importJSON } from "./state.js";

function baseUrl(settings) {
  const url = (settings.syncServerUrl || "").trim();
  if (!url) throw new Error("No sync server configured — set it in Settings.");
  return url.replace(/\/+$/, "");
}

// The key is optional: with Tailscale sign-in on the server (see server/README.md) the
// request is authorised by who sent it, so no header is needed.
function authHeaders(settings, extra = {}) {
  const key = (settings.syncApiKey || "").trim();
  return key ? { ...extra, "X-Api-Key": key } : extra;
}

export async function backupToServer(settings) {
  const res = await fetch(`${baseUrl(settings)}/backup`, {
    method: "PUT",
    headers: authHeaders(settings, { "Content-Type": "application/json" }),
    body: exportJSON(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Returns the same { ok, error? } shape as state.importJSON(). */
export async function restoreFromServer(settings) {
  const res = await fetch(`${baseUrl(settings)}/backup`, {
    method: "GET",
    headers: authHeaders(settings),
  });
  if (res.status === 404) return { ok: false, error: "No backup found on the server yet." };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return importJSON(text);
}

// ===== Retry until the T620 is reachable =====
// A web page can't see which Wi-Fi network it's on, so instead of "back up when I get
// home", a backup that can't reach the T620 stays queued and is retried at every
// chance: app opened or brought to the front, network change (e.g. 4G -> home Wi-Fi),
// every minute while open, and via Chrome's Background Sync while the app is closed.
// The first attempt after the T620 becomes reachable wins.

const PENDING_KEY = "stronglift.sync.pending";
const BG_CACHE = "stronglift-backup"; // must match service-worker.js
const BG_TAG = "stronglift-backup";
const RETRY_MS = 60 * 1000;
let inFlight = null;

export function hasPendingBackup() {
  try {
    return !!localStorage.getItem(PENDING_KEY);
  } catch (e) {
    return false;
  }
}

/** Queue a backup, and hand a copy to the service worker for Background Sync. */
export async function queueBackup(settings) {
  try {
    localStorage.setItem(PENDING_KEY, String(Date.now()));
  } catch (e) {
    /* ignore */
  }
  if (!("caches" in window) || !("serviceWorker" in navigator)) return;
  try {
    const cache = await caches.open(BG_CACHE);
    const job = { url: `${baseUrl(settings)}/backup`, key: settings.syncApiKey || "", body: exportJSON() };
    await cache.put("backup/pending", new Response(JSON.stringify(job), { headers: { "Content-Type": "application/json" } }));
    const reg = await navigator.serviceWorker.ready;
    if (reg.sync) await reg.sync.register(BG_TAG);
  } catch (e) {
    /* Background Sync unavailable — the in-app retries still cover it */
  }
}

export async function clearPendingBackup() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch (e) {
    /* ignore */
  }
  try {
    if ("caches" in window) await (await caches.open(BG_CACHE)).delete("backup/pending");
  } catch (e) {
    /* ignore */
  }
}

/**
 * Back up now if something is queued (or `force`). Resolves true on success, false on
 * failure, null if there was nothing to do. Never throws.
 */
export function syncIfPending(settings, { force = false } = {}) {
  if (!settings.syncServerUrl || (!force && !hasPendingBackup())) return Promise.resolve(null);
  if (inFlight) return inFlight;
  inFlight = backupToServer(settings)
    .then(async () => {
      await clearPendingBackup();
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Queue a backup and try it straight away (used after finishing a workout). */
export async function backupAfterWorkout(settings) {
  await queueBackup(settings);
  return syncIfPending(settings);
}

/** Start the retry triggers. `getSettings` returns current settings; `onSynced` runs after a queued backup lands. */
export function startAutoRetry(getSettings, onSynced) {
  const attempt = async () => {
    if (!hasPendingBackup()) return;
    if ((await syncIfPending(getSettings())) === true && onSynced) onSynced();
  };
  attempt();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") attempt();
  });
  window.addEventListener("online", attempt);
  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener("change", attempt);
  }
  setInterval(() => {
    if (document.visibilityState === "visible") attempt();
  }, RETRY_MS);
  if ("serviceWorker" in navigator) {
    // The service worker's Background Sync got there first: drop the queued flag.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "backup-done") {
        clearPendingBackup();
        if (onSynced) onSynced();
      }
    });
  }
}
