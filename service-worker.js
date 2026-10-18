// service-worker.js — offline cache for the app shell. All paths are relative so this
// works unmodified whether served from a domain root or a GitHub Pages /<repo>/ subpath
// (the scope is wherever this file is registered from).
const CACHE_NAME = "stronglift-cache-v3";

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
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Page navigations: try the network first (so a redeploy shows up promptly), fall
  // back to the cached shell when offline. Routing is hash-based, so every route is
  // the same index.html — this one fallback covers the whole app.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  // Everything else: cache-first, then network (and cache what we fetch).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
