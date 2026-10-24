// app.js — bootstrap + hash router. Hash routing is deliberate: it needs no server
// rewrite rules, which keeps GitHub Pages' /<repo>/ subpath simple.
import { load } from "./state.js";
import { startAutoRetry, syncIfPending, queueBackup } from "./sync.js";

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

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// "#/backup" — the home-screen shortcut, or an automation (MacroDroid/Tasker) opening
// it on home Wi-Fi right after connecting Tailscale. Tailscale can take a few seconds to
// come up, so keep trying for a while before leaving it to the normal retries.
const BACKUP_TRIES = 10;
const BACKUP_TRY_GAP_MS = 4000;

async function runBackupShortcut(settings) {
  toast("Backing up to T620…");
  await queueBackup(settings); // so a failure here still retries later
  for (let i = 0; i < BACKUP_TRIES; i++) {
    if ((await syncIfPending(settings)) !== false) return toast("Backed up to T620.");
    await new Promise((r) => setTimeout(r, BACKUP_TRY_GAP_MS));
  }
  toast("Couldn't reach the T620. It'll keep retrying.");
}

function handleBackupShortcut() {
  if (parseHash().name !== "backup") return false;
  const settings = load().settings;
  if (!settings.syncServerUrl) toast("Set up T620 sync in Settings first.");
  else runBackupShortcut(settings);
  history.replaceState(null, "", `#/${DEFAULT_ROUTE}`);
  return true;
}

window.addEventListener("hashchange", () => {
  handleBackupShortcut(); // swaps "#/backup" for Home, then render shows Home
  render();
});
window.addEventListener("DOMContentLoaded", () => {
  handleBackupShortcut();
  if (!location.hash) location.hash = `#/${DEFAULT_ROUTE}`;
  else render();
  // Retry any queued T620 backup whenever there's a chance it'll get through.
  startAutoRetry(() => load().settings, () => toast("Backed up to T620."));
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
