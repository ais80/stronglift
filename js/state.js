// state.js — single source of truth for persisted app state (localStorage).
// Key stays "stronglift.v1" even across internal schema bumps; the internal
// `version` field is what migrate() uses to upgrade old payloads in place.
import { seedState, SCHEMA_VERSION, defaultSettings } from "../data/seed.js";

const STORAGE_KEY = "stronglift.v1";

let cache = null;
const listeners = new Set();

/** Call `cb(state)` after every local change (not after seeding or applying a merge). */
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[state] failed to parse stored state, reseeding:", e);
    return null;
  }
}

/** Upgrade an older stored shape to the current schema. Add cases as the schema grows. */
export function migrate(state) {
  if (!state || typeof state !== "object") return seedState();
  let s = state;

  if (!s.version) s.version = 1;

  // v1 -> v2: added alternates/cue/repUnit per exercise, plus 14 alternate and 5
  // accessory exercises, plus settings.defaultSetScheme. Existing users' own
  // exercises/progress/history are preserved as-is; only missing pieces are added.

  // Fill in any keys a partial/older payload might be missing, without clobbering data.
  const seed = seedState();
  s.settings = { ...seed.settings, ...(s.settings || {}) };
  s.exercises = Array.isArray(s.exercises) && s.exercises.length ? s.exercises : seed.exercises;
  s.programDays = s.programDays || seed.programDays;
  s.progress = s.progress || {};

  // Backfill new per-exercise fields on whatever exercises the user already has.
  for (const ex of s.exercises) {
    if (ex.alternates === undefined) ex.alternates = [];
    if (ex.cue === undefined) ex.cue = "";
    if (ex.repUnit === undefined) ex.repUnit = "reps";
    if (ex.deloadFloor === undefined) ex.deloadFloor = ex.startWeight;
  }

  // Add any newly-seeded exercises (alternates/accessories) the user doesn't have yet,
  // identified by id, without touching exercises/progress the user already has.
  const existingIds = new Set(s.exercises.map((ex) => ex.id));
  for (const ex of seed.exercises) {
    if (!existingIds.has(ex.id)) {
      s.exercises.push(ex);
      existingIds.add(ex.id);
    }
  }

  // v2 -> v3: added Smith-machine alternates for squat/bench/press. The loop above
  // adds the new exercises themselves, but an existing user's own squat/bench/press
  // entries need the new ids appended to their *alternates* list too -- append-only
  // and de-duped, so a user's own edits to that list (via Lifts) are never clobbered.
  for (const seedEx of seed.exercises) {
    if (!seedEx.equivalentTo) continue;
    const parent = s.exercises.find((ex) => ex.id === seedEx.equivalentTo);
    if (parent && Array.isArray(parent.alternates) && !parent.alternates.includes(seedEx.id)) {
      parent.alternates.push(seedEx.id);
    }
  }
  for (const ex of s.exercises) {
    if (ex.equivalentTo === undefined) ex.equivalentTo = null;
    if (ex.loadMultiplier === undefined) ex.loadMultiplier = null;
  }

  for (const ex of s.exercises) {
    if (!s.progress[ex.id]) {
      s.progress[ex.id] = { currentWeight: ex.startWeight, consecutiveFailures: 0 };
    }
  }
  s.history = Array.isArray(s.history) ? s.history : [];
  s.nextDay = s.nextDay === "A" || s.nextDay === "B" ? s.nextDay : "A";
  s.updatedAt = Number(s.updatedAt) || 0;
  s.deletedHistoryIds = Array.isArray(s.deletedHistoryIds) ? s.deletedHistoryIds : [];
  s.version = SCHEMA_VERSION;

  return s;
}

/** Load state from localStorage, seeding/migrating as needed. Always returns a usable object. */
export function load() {
  if (cache) return cache;
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[state] localStorage unavailable, using in-memory state:", e);
  }
  if (!raw) {
    // updatedAt stays 0, so a merge with the Google Sheet copy lets that win.
    cache = seedState();
    save(cache, { touch: false });
    return cache;
  }
  const parsed = safeParse(raw);
  cache = migrate(parsed);
  return cache;
}

/**
 * Persist the given state to localStorage. `touch` (the default) marks it as a local
 * change: stamps updatedAt and tells onChange listeners (the Google Sheet sync).
 */
export function save(state, { touch = true } = {}) {
  if (touch) state.updatedAt = Date.now();
  cache = state;
  let ok = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[state] failed to save state (storage full or unavailable):", e);
    ok = false;
  }
  if (touch) listeners.forEach((cb) => cb(state));
  return ok;
}

/** Mutate the cached state via an updater function, then persist. Returns the new state. */
export function update(updater) {
  const current = load();
  const next = updater(current) || current;
  save(next);
  return next;
}

export function resetAll() {
  const old = load();
  const fresh = seedState();
  // Tombstone the old history too, or the next sync would merge it back in.
  fresh.deletedHistoryIds = [...old.deletedHistoryIds, ...old.history.map((h) => h.id)];
  fresh.syncedBaseAt = old.syncedBaseAt;
  save(fresh);
  return fresh;
}

/** Delete one history session, remembering its id so a sync doesn't bring it back. */
export function deleteHistory(sessionId) {
  return update((s) => ({
    ...s,
    history: s.history.filter((h) => h.id !== sessionId),
    deletedHistoryIds: s.deletedHistoryIds.includes(sessionId) ? s.deletedHistoryIds : [...s.deletedHistoryIds, sessionId],
  }));
}

/**
 * Combine this device's state with the copy from the Google Sheet so nothing is lost.
 * History is the union of both (by session id, minus anything deleted on either side).
 * Everything else (progress, settings, lifts, next day) comes from whichever side changed
 * last, except that a device that has never synced always takes the sheet's — that's
 * the "phone's storage got wiped and reseeded at 20kg" case.
 */
export function mergeStates(local, remote) {
  if (!remote || !Array.isArray(remote.history)) return local;
  remote = migrate(remote);
  const deleted = new Set([...local.deletedHistoryIds, ...remote.deletedHistoryIds]);
  const byId = new Map();
  for (const h of [...remote.history, ...local.history]) {
    if (!deleted.has(h.id)) byId.set(h.id, h);
  }
  const history = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const remoteWins = local.syncedBaseAt == null || remote.updatedAt >= local.updatedAt;
  const base = remoteWins ? remote : local;
  return {
    ...base,
    history,
    deletedHistoryIds: [...deleted],
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    syncedBaseAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

export function exportJSON() {
  return JSON.stringify(load(), null, 2);
}

/** Returns { ok, error? }. On success, the imported state replaces the current one. */
export function importJSON(text) {
  const parsed = safeParse(text);
  if (!parsed) return { ok: false, error: "That file isn't valid JSON." };
  try {
    const migrated = migrate(parsed);
    // An import is deliberate: it beats the sheet's copy on the next sync, and sessions
    // on this device that the import doesn't have are tombstoned so they don't merge back.
    const kept = new Set(migrated.history.map((h) => h.id));
    const dropped = load().history.map((h) => h.id).filter((id) => !kept.has(id));
    migrated.deletedHistoryIds = [...new Set([...migrated.deletedHistoryIds, ...dropped])];
    migrated.syncedBaseAt = Date.now();
    save(migrated);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "That file doesn't look like a StrongLift export." };
  }
}

export { defaultSettings };
