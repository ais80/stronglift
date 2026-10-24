// restNotify.js — the page's side of the lock-screen workout notification.
//
// The service worker owns the notification itself (see service-worker.js): it shows
// "Up next" / "Resting · next set at 14:35" / "Rest over", fires the rest-over alert
// even if this page is asleep, and handles the "✓ Done" button. A set logged from the
// notification is queued in a small cache; the Workout screen picks it up with
// takePending() the next time it runs.
//
// Media-safe: only notifications and vibration, never audio, so YT Music keeps playing.

const PENDING_CACHE = "stronglift-pending"; // must match service-worker.js

export function canNotify(settings) {
  return (
    !!settings.notifyOnTimerEnd &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    "serviceWorker" in navigator
  );
}

/** Send a message to the service worker. Never throws. */
export async function post(type, info) {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const target = navigator.serviceWorker.controller || reg.active;
    if (target) target.postMessage({ type, info });
  } catch (e) {
    console.warn("[restNotify] post failed:", e);
  }
}

/** Read and remove every set logged from the notification, oldest first. */
export async function takePending() {
  if (!("caches" in window)) return [];
  try {
    const cache = await caches.open(PENDING_CACHE);
    const keys = await cache.keys();
    const out = [];
    for (const key of keys) {
      const res = await cache.match(key);
      if (res) out.push(await res.json());
      await cache.delete(key);
    }
    return out.sort((a, b) => a.at - b.at);
  } catch (e) {
    console.warn("[restNotify] could not read pending sets:", e);
    return [];
  }
}

export async function clearPending() {
  if (!("caches" in window)) return;
  try {
    await caches.delete(PENDING_CACHE);
  } catch (e) {
    /* ignore */
  }
}

/** Call `cb` whenever the service worker says a set was logged from the notification. */
export function onPending(cb) {
  if (!("serviceWorker" in navigator)) return () => {};
  const handler = (event) => {
    if (event.data && event.data.type === "pending-sets") cb();
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
