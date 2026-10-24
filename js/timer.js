// timer.js — rest timer. MEDIA-SAFE BY DESIGN (see BUILD_PLAN.md §5/§5a): it never uses
// the Media Session API or an <audio>/<video> element, because either of those requests
// audio focus from Android and would pause/duck YT Music, Spotify, etc. In-app the alert
// is vibration. Lock-screen/watch notifications live in the service worker (see
// restNotify.js). The only sound option (`setBeepEnabled`, default OFF) is a short
// WebAudio tone.

// localStorage (not sessionStorage) so a running rest survives Android killing the app.
const SESSION_KEY = "stronglift.timer.endAt";

let intervalId = null;
let onTickCb = null;
let onDoneCb = null;
let beepEnabled = false;
let audioCtx = null;

export function isRunning() {
  return intervalId !== null;
}

/** When the current rest ends (ms since epoch), or 0 if none is stored. */
export function storedEndAt() {
  try {
    return Number(localStorage.getItem(SESSION_KEY) || 0);
  } catch (e) {
    return 0; // storage unavailable — timer just won't survive a reload
  }
}

export function remainingSeconds() {
  const endAt = storedEndAt();
  if (!endAt) return 0;
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

/** Start (or restart) the rest countdown so it ends at `endAt` (ms since epoch). */
export function startUntil(endAt, { onTick, onDone } = {}) {
  stop();
  try {
    localStorage.setItem(SESSION_KEY, String(endAt));
  } catch (e) {
    /* ignore */
  }
  onTickCb = onTick || null;
  onDoneCb = onDone || null;
  tick(); // paint immediately instead of waiting for the first interval
  intervalId = setInterval(tick, 500);
}

export function start(seconds, callbacks) {
  startUntil(Date.now() + seconds * 1000, callbacks);
}

export function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
}

function tick() {
  const remaining = remainingSeconds();
  if (onTickCb) onTickCb(remaining);
  if (remaining <= 0 && isRunning()) {
    fireAlert();
    const done = onDoneCb;
    stop();
    if (done) done();
  }
}

// setInterval is throttled in a backgrounded tab, so the displayed countdown can lag —
// recompute the instant the tab becomes visible/focused again rather than waiting for
// the next (possibly delayed) tick. This is what makes the timer "survive" backgrounding.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isRunning()) tick();
});
window.addEventListener("focus", () => {
  if (isRunning()) tick();
});

export function setBeepEnabled(enabled) {
  beepEnabled = !!enabled;
}

/** Call only from a user gesture (e.g. a Settings toggle) — never on page load. */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

function fireAlert() {
  // Vibration — never touches audio, so it can't interfere with music. Chrome only
  // allows it while the app is on screen; the service worker's notification covers the
  // locked-phone case and buzzes the watch.
  if (document.visibilityState === "visible" && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {
      /* ignore */
    }
  }

  // Optional beep — OFF unless turned on in Settings. Short WebAudio tone only (no
  // <audio>, no Media Session API).
  if (beepEnabled) playBeep();
}

export function playBeep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn("[timer] beep failed:", e);
  }
}

export function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
