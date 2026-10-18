// timer.js — rest timer. MEDIA-SAFE BY DESIGN (see BUILD_PLAN.md §5/§5a):
// the end-of-rest alert is vibration + an optional silent Notification. It never uses
// the Media Session API or an <audio>/<video> element, because either of those requests
// audio focus from Android and would pause/duck Spotify, YouTube, etc. The only sound
// option (`setBeepEnabled`, default OFF) is a short WebAudio tone, which Android treats
// as a transient UI sound rather than a media stream.

const SESSION_KEY = "stronglift.timer.endAt";

let intervalId = null;
let onTickCb = null;
let onDoneCb = null;
let notifyEnabled = false;
let beepEnabled = false;
let audioCtx = null;

export function isRunning() {
  return intervalId !== null;
}

export function remainingSeconds() {
  let endAt = 0;
  try {
    endAt = Number(sessionStorage.getItem(SESSION_KEY) || 0);
  } catch (e) {
    /* sessionStorage unavailable — timer just won't survive a reload */
  }
  if (!endAt) return 0;
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

/** Start (or restart) the rest countdown. */
export function start(seconds, { onTick, onDone } = {}) {
  stop();
  const endAt = Date.now() + seconds * 1000;
  try {
    sessionStorage.setItem(SESSION_KEY, String(endAt));
  } catch (e) {
    /* ignore */
  }
  onTickCb = onTick || null;
  onDoneCb = onDone || null;
  tick(); // paint immediately instead of waiting for the first interval
  intervalId = setInterval(tick, 500);
}

export function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
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

export function setNotificationsEnabled(enabled) {
  notifyEnabled = !!enabled;
}

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
  // 1) Vibration — primary alert. Never touches audio, so it can't interfere with media.
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {
      /* ignore */
    }
  }

  // 2) Notification — fires even while backgrounded; on the S24+ this mirrors to a paired
  //    Galaxy Watch 4 and buzzes it. Silent + low priority so it never plays a sound.
  if (notifyEnabled && "Notification" in window && Notification.permission === "granted") {
    const payload = { body: "Time for your next set.", tag: "stronglift-rest", silent: true };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification("Rest over", { ...payload, renotify: true }))
          .catch(() => new Notification("Rest over", payload));
      } else {
        new Notification("Rest over", payload);
      }
    } catch (e) {
      console.warn("[timer] notification failed:", e);
    }
  }

  // 3) Optional beep — OFF unless the user turned it on in Settings. Short WebAudio tone
  //    only (see the file header for why — no <audio>, no Media Session API).
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
