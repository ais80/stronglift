// views/home.js — landing screen: today's workout at a glance.
import { buildWorkout, effectiveSets } from "../program.js";
import { update } from "../state.js";
import { fmtWeight, escapeHtml, fmtDate } from "../util.js";

export async function render(container, state, params, ctx) {
  paint(container, state, ctx);
}

function paint(container, state, ctx) {
  const day = state.nextDay;
  const scheme = state.settings.defaultSetScheme;
  const workout = buildWorkout(day, state);
  const lastSession = state.history[0];

  const liftsHtml = workout
    .map((w) => {
      const progress = state.progress[w.exerciseId] || { consecutiveFailures: 0 };
      const streakNote =
        progress.consecutiveFailures > 0
          ? `<div class="card-sub">${progress.consecutiveFailures} miss${progress.consecutiveFailures > 1 ? "es" : ""} in a row</div>`
          : "";
      const sets = effectiveSets(w.setsReps.sets, scheme);
      return `<div class="card">
        <div class="card-row">
          <span class="card-title">${escapeHtml(w.name)}</span>
          <span class="exercise-weight">${fmtWeight(w.targetWeight, state.settings.units)}</span>
        </div>
        <div class="card-sub">${sets} &times; ${w.setsReps.reps}</div>
        ${streakNote}
      </div>`;
    })
    .join("");

  const lastSessionHtml = lastSession
    ? `<p class="screen-sub">Last workout: ${fmtDate(lastSession.date)} (Day ${lastSession.day})</p>`
    : `<p class="screen-sub">No workouts logged yet — let's get started.</p>`;

  container.innerHTML = `
    <h1 class="screen-title">Workout ${day}</h1>
    ${lastSessionHtml}
    <div class="scheme-toggle">
      <button type="button" class="scheme-btn ${scheme === "5x5" ? "active" : ""}" data-scheme="5x5">5&times;5</button>
      <button type="button" class="scheme-btn ${scheme === "3x5" ? "active" : ""}" data-scheme="3x5">3&times;5 (faster)</button>
    </div>
    ${liftsHtml || `<div class="empty-state">No exercises set up for Day ${day} yet. Add some in Lifts.</div>`}
    <button type="button" class="btn btn-primary" id="startBtn" style="margin-top: 8px;">
      Start workout
    </button>
  `;

  container.querySelectorAll(".scheme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newScheme = btn.dataset.scheme;
      if (newScheme === state.settings.defaultSetScheme) return;
      const next = update((s) => ({ ...s, settings: { ...s.settings, defaultSetScheme: newScheme } }));
      paint(container, next, ctx);
    });
  });

  container.querySelector("#startBtn").addEventListener("click", () => ctx.navigate("workout"));
}
