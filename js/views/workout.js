// views/workout.js — the live workout screen: the core loop of the app.
import { buildWorkout, applyWorkoutResult } from "../program.js";
import { platesFor, warmupSets } from "../calc.js";
import { save } from "../state.js";
import { fmtWeight, escapeHtml } from "../util.js";
import * as timer from "../timer.js";

const DRAFT_KEY = "stronglift.workout.draft";

function loadDraft(day, state) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.day === day && Array.isArray(parsed.entries)) return parsed;
    }
  } catch (e) {
    console.warn("[workout] could not read draft, starting fresh:", e);
  }
  return buildDraft(day, state);
}

function buildDraft(day, state) {
  const workout = buildWorkout(day, state);
  return {
    day,
    startedAt: Date.now(),
    entries: workout.map((w) => {
      const exercise = state.exercises.find((e) => e.id === w.exerciseId);
      return {
        exerciseId: w.exerciseId,
        name: w.name,
        type: w.type,
        setsReps: w.setsReps,
        targetWeight: w.targetWeight,
        increment: exercise ? exercise.increment : 2.5,
        warmupOn: true,
        sets: Array.from({ length: w.setsReps.sets }, () => ({ reps: null })),
      };
    }),
  };
}

function persistDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    /* non-fatal: worst case a reload loses in-progress logging for this set */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    /* ignore */
  }
}

export async function render(container, state, params, ctx) {
  const day = params[0] === "A" || params[0] === "B" ? params[0] : state.nextDay;
  const draft = loadDraft(day, state);

  container.innerHTML = `
    <div class="back-row">
      <button type="button" class="back-btn" data-action="back">&larr; Home</button>
    </div>
    <h1 class="screen-title">Workout ${day}</h1>
    <p class="screen-sub">Tap a set once you've done it. Tap it again to correct the reps.</p>
    <div id="workoutBody"></div>
  `;

  const bodyEl = container.querySelector("#workoutBody");

  // The rest-timer bar is appended at document level (not inside #app) so repainting
  // the exercise list on every tap doesn't tear it down mid-countdown.
  const timerBarEl = document.createElement("div");
  timerBarEl.className = "timer-bar";
  timerBarEl.hidden = true;
  timerBarEl.innerHTML = `
    <span>Resting&hellip;</span>
    <span class="timer-count" id="timerCount">0:00</span>
    <button type="button" class="btn btn-ghost" id="skipRestBtn" style="width:auto;">Skip</button>
  `;
  document.body.appendChild(timerBarEl);

  function startRestTimer(seconds) {
    timerBarEl.hidden = false;
    timer.setNotificationsEnabled(!!state.settings.notifyOnTimerEnd);
    timer.setBeepEnabled(!!state.settings.soundOnTimerEnd);
    timer.start(seconds, {
      onTick: (remaining) => {
        const el = timerBarEl.querySelector("#timerCount");
        if (el) el.textContent = timer.formatMMSS(remaining);
      },
      onDone: () => {
        timerBarEl.hidden = true;
      },
    });
  }

  timerBarEl.querySelector("#skipRestBtn").addEventListener("click", () => {
    timer.stop();
    timerBarEl.hidden = true;
  });

  function cleanup() {
    timer.stop();
    timerBarEl.remove();
    window.removeEventListener("hashchange", cleanup);
  }
  window.addEventListener("hashchange", cleanup);

  function paintBody() {
    bodyEl.innerHTML = buildExercisesHtml(draft, state);
  }
  paintBody();

  function onSetLogged(entry, set) {
    const hit = set.reps >= entry.setsReps.reps;
    const seconds = hit ? state.settings.restSecsMain : state.settings.restSecsLast;
    startRestTimer(seconds);
  }

  bodyEl.addEventListener("click", (e) => {
    const cellBtn = e.target.closest('[data-action="set-cell"]');
    if (cellBtn) {
      const exIdx = Number(cellBtn.dataset.ex);
      const setIdx = Number(cellBtn.dataset.set);
      const entry = draft.entries[exIdx];
      const set = entry.sets[setIdx];

      if (set.reps === null) {
        // First tap: assume the common case — a full, successful set.
        set.reps = entry.setsReps.reps;
        onSetLogged(entry, set);
      } else {
        // Already logged: offer to correct it (this is how a miss gets recorded).
        const answer = window.prompt(
          `Reps completed — ${entry.name}, set ${setIdx + 1} (target ${entry.setsReps.reps}). Leave blank to clear.`,
          String(set.reps)
        );
        if (answer === null) return; // cancelled
        if (answer.trim() === "") {
          set.reps = null;
        } else {
          const n = parseInt(answer, 10);
          if (!Number.isNaN(n)) {
            set.reps = Math.max(0, Math.min(99, n));
            onSetLogged(entry, set);
          }
        }
      }
      persistDraft(draft);
      paintBody();
      return;
    }

    const finishBtn = e.target.closest('[data-action="finish"]');
    if (finishBtn) {
      const entries = draft.entries.map((entry) => ({
        exerciseId: entry.exerciseId,
        targetWeight: entry.targetWeight,
        sets: entry.sets.map((s) => ({ reps: s.reps ?? 0, target: entry.setsReps.reps })),
      }));
      const durationSecs = Math.round((Date.now() - draft.startedAt) / 1000);
      const next = applyWorkoutResult(state, day, entries, durationSecs);
      save(next);
      clearDraft();
      cleanup();
      ctx.navigate("home");
    }
  });

  bodyEl.addEventListener("change", (e) => {
    const toggle = e.target.closest('[data-action="warmup-toggle"]');
    if (toggle) {
      const exIdx = Number(toggle.dataset.ex);
      draft.entries[exIdx].warmupOn = toggle.checked;
      persistDraft(draft);
      paintBody();
    }
  });

  container.querySelector('[data-action="back"]').addEventListener("click", () => {
    cleanup();
    ctx.navigate("home");
  });
}

function buildExercisesHtml(draft, state) {
  const blocks = draft.entries
    .map((entry, exIdx) => {
      const isBarbell = entry.type !== "bodyweight";
      let platesText = "";
      let warnText = "";
      let warmupHtml = "";

      if (isBarbell) {
        const plates = platesFor(entry.targetWeight, state.settings.barWeight, state.settings.plates);
        platesText = plates.perSide.length
          ? plates.perSide.map((p) => `${trim(p.weight)}×${p.count}`).join(" + ") + " /side"
          : "Bar only";
        warnText = plates.exact
          ? ""
          : ` &middot; closest achievable: ${fmtWeight(plates.achievedWeight, state.settings.units)}`;

        const warmups = entry.warmupOn
          ? warmupSets(entry.targetWeight, state.settings.barWeight, entry.increment)
          : [];
        warmupHtml = warmups.length
          ? `<div class="plates-row">Warm-up: ${warmups
              .map((w) => `${fmtWeight(w.weight, state.settings.units)}×${w.reps}`)
              .join(", ")}</div>`
          : "";
      }

      const setsHtml = entry.sets
        .map((s, setIdx) => {
          const cls = s.reps === null ? "" : s.reps >= entry.setsReps.reps ? "done" : "missed";
          const label = s.reps === null ? entry.setsReps.reps : s.reps;
          return `<button type="button" class="set-cell ${cls}" data-action="set-cell" data-ex="${exIdx}" data-set="${setIdx}">
            <span>${label}</span><span class="set-reps-label">reps</span>
          </button>`;
        })
        .join("");

      return `<div class="exercise-block">
        <div class="exercise-head">
          <span class="exercise-name">${escapeHtml(entry.name)}</span>
          <span class="exercise-weight">${fmtWeight(entry.targetWeight, state.settings.units)}</span>
        </div>
        ${isBarbell ? `<div class="plates-row">${platesText}${warnText}</div>` : ""}
        ${
          isBarbell
            ? `<label class="switch-row">
          <span>Warm-up sets</span>
          <input type="checkbox" data-action="warmup-toggle" data-ex="${exIdx}" ${entry.warmupOn ? "checked" : ""}>
        </label>`
            : ""
        }
        ${warmupHtml}
        <div class="sets-grid">${setsHtml}</div>
      </div>`;
    })
    .join("");

  return `${blocks}
    <div class="btn-row" style="margin-top: 20px;">
      <button type="button" class="btn btn-primary" data-action="finish">Finish workout</button>
    </div>`;
}

function trim(n) {
  return Number(n.toFixed(2)).toString();
}
