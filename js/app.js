// app.js — bootstrap + hash router. Hash routing is deliberate: it needs no server
// rewrite rules, which keeps GitHub Pages' /<repo>/ subpath simple.
import { load } from "./state.js";

const routes = {
  home: () => import("./views/home.js"),
  workout: () => import("./views/workout.js"),
  history: () => import("./views/history.js"),
  progress: () => import("./views/progress.js"),
  exercises: () => import("./views/exercises.js"),
  settings: () => import("./views/settings.js"),
};

const DEFAULT_ROUTE = "home";
const appEl = document.getElementById("app");
const navItems = Array.from(document.querySelectorAll(".nav-item"));

function parseHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const [name, ...rest] = raw.split("/");
  return { name: name || DEFAULT_ROUTE, params: rest };
}

function setActiveNav(name) {
  for (const el of navItems) {
    el.classList.toggle("active", el.dataset.route === name);
  }
  // The Workout screen is a flow entered from Home, not a tab of its own —
  // keep Home highlighted while it's showing so the nav doesn't look "lost".
  if (name === "workout") {
    const homeEl = navItems.find((el) => el.dataset.route === "home");
    if (homeEl) homeEl.classList.add("active");
  }
}

async function render() {
  const { name, params } = parseHash();
  const routeName = routes[name] ? name : DEFAULT_ROUTE;
  setActiveNav(routeName);

  try {
    const mod = await routes[routeName]();
    appEl.innerHTML = "";
    const state = load();
    await mod.render(appEl, state, params, { navigate });
  } catch (err) {
    console.error("[app] route render failed:", err);
    appEl.innerHTML = `<div class="empty-state">Something went wrong loading this screen.</div>`;
  }
}

export function navigate(path) {
  location.hash = path.startsWith("#") ? path : `#/${path}`;
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = `#/${DEFAULT_ROUTE}`;
  else render();
});

// Apply stored theme preference immediately (before first paint of content).
try {
  const s = load();
  if (s?.settings?.theme === "light" || s?.settings?.theme === "dark") {
    document.documentElement.setAttribute("data-theme", s.settings.theme);
  }
} catch (e) {
  console.warn("[app] theme preload skipped:", e);
}

// Register the service worker (PWA offline support). Relative path — required
// for the GitHub Pages /<repo>/ subpath to register with the right scope.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("[app] service worker registration failed:", err);
    });
  });
}
