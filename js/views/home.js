// views/home.js — landing screen: today's workout at a glance.
import { buildWorkout } from "../program.js";
import { fmtWeight, escapeHtml, fmtDate } from "../util.js";

export async function render(container, state, params, ctx) {
  const day = state.nextDay;
  const workout = buildWorkout(day, state);
  const lastSession = state.history[0];

  const liftsHtml = workout
    .map((w) => {
      const progress = state.progress[w.exerciseId] || { consecutiveFailures: 0 };
      const streakNote =
        progress.consecutiveFailures > 0
          ? `<div class="card-sub">${progress.consecutiveFailures} miss${progress.consecutiveFailures > 1 ? "es" : ""} in a row</div>`
          : "";
      return `<div class="card">
        <div class="card-row">
          <span class="card-title">${escapeHtml(w.name)}</span>
          <span class="exercise-weight">${fmtWeight(w.targetWeight, state.settings.units)}</span>
        </div>
        <div class="card-sub">${w.setsReps.sets} &times; ${w.setsReps.reps}</div>
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
    ${liftsHtml || `<div class="empty-state">No exercises set up for Day ${day} yet. Add some in Lifts.</div>`}
    <button type="button" class="btn btn-primary" id="startBtn" style="margin-top: 8px;">
      Start workout
    </button>
  `;

  container.querySelector("#startBtn").addEventListener("click", () => ctx.navigate("workout"));
}
