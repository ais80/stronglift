// service-worker.js — offline cache for the app shell. All paths are relative so this
// works unmodified whether served from a domain root or a GitHub Pages /<repo>/ subpath
// (the scope is wherever this file is registered from).
const CACHE_NAME = "stronglift-cache-v11";
// How long to wait for the network before falling back to the cached copy (gym signal).
const NETWORK_TIMEOUT_MS = 3000;
// Sets logged from the lock-screen notification, waiting for the page to apply them.
// Kept across app updates (activate below must not delete it).
const PENDING_CACHE = "stronglift-pending";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/state.js",
  "./js/program.js",
  "./js/calc.js",
  "./js/timer.js",
  "./js/util.js",
  "./js/sync.js",
  "./js/restNotify.js",
  "./js/views/home.js",
  "./js/views/workout.js",
  "./js/views/history.js",
  "./js/views/progress.js",
  "./js/views/exercises.js",
  "./js/views/settings.js",
  "./data/seed.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: "reload" skips the browser's HTTP cache (GitHub Pages sends max-age=600),
      // which could otherwise hand a new version the previous version's files.
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== PENDING_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Other origins (the Google Sheet sync) go straight to the network, never the cache.
  if (new URL(req.url).origin !== location.origin) return;

  // Network first, so a redeploy shows up on the next open; the cached copy when offline
  // or when the network is too slow. no-cache revalidates with the server (a cheap 304
  // when nothing changed) instead of trusting the browser's 10-minute HTTP cache.
  // Routing is hash-based, so every page navigation is the same index.html.
  const fallback = () =>
    caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
  const network = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
    }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  event.respondWith(
    Promise.race([network.catch(() => null), timeout]).then(async (res) => {
      if (res) return res;
      const hit = await fallback();
      return hit || network; // nothing cached yet: keep waiting for the network
    })
  );
});

// ===== Lock-screen workout notification =====
// One notification (tag REST_TAG) that always shows the next set to do, with a
// "✓ Done" button that logs it without opening the app. Its `data` carries everything
// needed — session id, rest end time, and the queue of remaining sets (labels built by
// the page) — so this keeps working while the page itself is asleep.
//
// Media-safe: the only alert is the rest-over notification's vibration. Every other
// update is `silent`. Nothing here plays audio, so YT Music is never paused. (If the
// phone's notification sound for StrongLift is left on, Android may dip the music for
// a moment at rest-over — set that sound to Silent; see TESTING.md.)

const REST_TAG = "stronglift-rest";
// Chrome stops a service worker whose event runs past ~5 minutes; stay under that.
// Longer rests fall back to the page's own timer.
const MAX_WAIT_MS = 290 * 1000;
let scheduledEndAt = 0;

function clockTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function showRest(info, alert = false) {
  const next = (info.queue || [])[0];
  const resting = !alert && info.endAt > Date.now();
  let title;
  let body;
  if (!next) {
    title = "All sets logged";
    body = "Open StrongLift to finish your workout.";
  } else if (alert) {
    title = "Rest over — next set";
    body = next.label;
  } else if (resting) {
    title = `Resting · next set at ${clockTime(info.endAt)}`;
    body = `Next: ${next.label}`;
  } else {
    title = "Up next";
    body = next.label;
  }
  const options = {
    body,
    tag: REST_TAG,
    icon: "icons/icon-192.png",
    data: { ...info, alerted: alert && !!next },
    actions: next ? [{ action: "log", title: next.actionTitle }] : [],
    timestamp: resting ? info.endAt : Date.now(),
  };
  if (alert && next) {
    Object.assign(options, { silent: false, renotify: true, requireInteraction: true, vibrate: [300, 150, 300] });
  } else {
    options.silent = true;
  }
  return self.registration.showNotification(title, options);
}

/** Show the rest-over alert for `info.endAt`, unless it's stale or already shown. */
async function fireOver(info) {
  const [current] = await self.registration.getNotifications({ tag: REST_TAG });
  if (current) {
    const d = current.data || {};
    if (d.endAt !== info.endAt || d.alerted || !(d.queue || []).length) return;
    return showRest(d, true);
  }
  if ((info.queue || []).length) return showRest(info, true);
}

/** Wait (inside an event's waitUntil) until the rest ends, then alert. */
function scheduleOver(info) {
  scheduledEndAt = info.endAt;
  const wait = info.endAt - Date.now();
  if (!info.endAt || wait > MAX_WAIT_MS) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, wait))).then(() => {
    if (scheduledEndAt !== info.endAt) return; // superseded, skipped or cleared
    return fireOver(info);
  });
}

async function closeRest() {
  scheduledEndAt = 0;
  const list = await self.registration.getNotifications({ tag: REST_TAG });
  list.forEach((n) => n.close());
}

self.addEventListener("message", (event) => {
  const { type, info } = event.data || {};
  if (type === "rest-show") {
    if (!info.endAt) scheduledEndAt = 0;
    event.waitUntil(showRest(info).then(() => (info.schedule ? scheduleOver(info) : undefined)));
  } else if (type === "rest-over") {
    event.waitUntil(fireOver(info));
  } else if (type === "rest-clear") {
    event.waitUntil(closeRest());
  }
});

async function logFromNotification(d) {
  const [item, ...rest] = d.queue || [];
  if (!item) return;
  const at = Date.now();
  const action = {
    id: `${at}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: d.sessionId,
    exIdx: item.exIdx,
    kind: item.kind,
    idx: item.idx,
    exerciseId: item.exerciseId,
    reps: item.reps,
    restAfter: item.restAfter || 0,
    at,
  };
  const cache = await caches.open(PENDING_CACHE);
  await cache.put(
    `pending/${action.id}`,
    new Response(JSON.stringify(action), { headers: { "Content-Type": "application/json" } })
  );
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type: "pending-sets" }));

  const info = {
    sessionId: d.sessionId,
    queue: rest,
    endAt: action.restAfter && rest.length ? at + action.restAfter * 1000 : 0,
  };
  scheduledEndAt = info.endAt;
  await showRest(info);
  if (info.endAt) await scheduleOver(info);
}

async function openApp() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if ("focus" in c) return c.focus();
  }
  return self.clients.openWindow("./#/workout");
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  if (n.tag !== REST_TAG) return;
  if (event.action === "log") event.waitUntil(logFromNotification(n.data || {}));
  else event.waitUntil(openApp());
});
