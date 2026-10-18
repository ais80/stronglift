// state.js — single source of truth for persisted app state (localStorage).
// Key stays "stronglift.v1" even across internal schema bumps; the internal
// `version` field is what migrate() uses to upgrade old payloads in place.
import { seedState, SCHEMA_VERSION, defaultSettings } from "../data/seed.js";

const STORAGE_KEY = "stronglift.v1";

let cache = null;

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

  // Example shape for a future bump:
  // if (s.version === 1) { ...transform...; s.version = 2; }

  // Fill in any keys a partial/older payload might be missing, without clobbering data.
  const seed = seedState();
  s.settings = { ...seed.settings, ...(s.settings || {}) };
  s.exercises = Array.isArray(s.exercises) && s.exercises.length ? s.exercises : seed.exercises;
  s.programDays = s.programDays || seed.programDays;
  s.progress = s.progress || {};
  for (const ex of s.exercises) {
    if (!s.progress[ex.id]) {
      s.progress[ex.id] = { currentWeight: ex.startWeight, consecutiveFailures: 0 };
    }
  }
  s.history = Array.isArray(s.history) ? s.history : [];
  s.nextDay = s.nextDay === "A" || s.nextDay === "B" ? s.nextDay : "A";
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
    cache = seedState();
    save(cache);
    return cache;
  }
  const parsed = safeParse(raw);
  cache = migrate(parsed);
  return cache;
}

/** Persist the given state (or the in-memory cache) to localStorage. */
export function save(state) {
  cache = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[state] failed to save state (storage full or unavailable):", e);
    return false;
  }
  return true;
}

/** Mutate the cached state via an updater function, then persist. Returns the new state. */
export function update(updater) {
  const current = load();
  const next = updater(current) || current;
  save(next);
  return next;
}

export function resetAll() {
  cache = seedState();
  save(cache);
  return cache;
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
    save(migrated);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "That file doesn't look like a StrongLift export." };
  }
}

export { defaultSettings };
