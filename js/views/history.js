// views/history.js — session list + per-session detail (delete needs confirmation).
import { update } from "../state.js";
import { fmtWeight, fmtDate, fmtDuration, escapeHtml } from "../util.js";

export async function render(container, state, params, ctx) {
  const sessionId = params[0];
  if (sessionId) {
    renderDetail(container, state, sessionId, ctx);
  } else {
    renderList(container, state, ctx);
  }
}

function renderList(container, state, ctx) {
  if (!state.history.length) {
    container.innerHTML = `
      <h1 class="screen-title">History</h1>
      <div class="empty-state">No workouts logged yet. Finish a workout to see it here.</div>
    `;
    return;
  }

  const rows = state.history
    .map((h) => {
      const hits = h.entries.filter((e) => e.success).length;
      return `<a class="card" style="display:block;" href="#/history/${h.id}">
        <div class="card-row">
          <span class="card-title">Day ${h.day} &middot; ${fmtDate(h.date)}</span>
          <span class="card-sub">${hits}/${h.entries.length} hit</span>
        </div>
        <div class="card-sub">${fmtDuration(h.durationSecs)}</div>
      </a>`;
    })
    .join("");

  container.innerHTML = `<h1 class="screen-title">History</h1>${rows}`;
}

function renderDetail(container, state, sessionId, ctx) {
  const session = state.history.find((h) => h.id === sessionId);
  if (!session) {
    container.innerHTML = `<div class="empty-state">That workout wasn't found.</div>`;
    return;
  }

  const exerciseRows = session.entries
    .map((entry) => {
      const exercise = state.exercises.find((e) => e.id === entry.exerciseId);
      const name = exercise ? exercise.name : entry.exerciseId;
      const setsText = entry.sets
        .map((s) => `${s.reps}/${s.target}`)
        .join(", ");
      const resultClass = entry.success ? "card-title" : "card-title";
      const resultIcon = entry.success ? "✅" : "❌";
      const deloadNote = entry.deloaded
        ? `<div class="card-sub">Deloaded &rarr; ${fmtWeight(entry.nextWeight, state.settings.units)}</div>`
        : entry.success
          ? `<div class="card-sub">Next: ${fmtWeight(entry.nextWeight, state.settings.units)}</div>`
          : "";
      return `<div class="card">
        <div class="card-row">
          <span class="${resultClass}">${resultIcon} ${escapeHtml(name)}</span>
          <span class="card-sub">${fmtWeight(entry.targetWeight, state.settings.units)}</span>
        </div>
        <div class="card-sub">Sets (reps/target): ${setsText}</div>
        ${deloadNote}
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="back-row">
      <button type="button" class="back-btn" data-action="back">&larr; History</button>
    </div>
    <h1 class="screen-title">Day ${session.day} &middot; ${fmtDate(session.date)}</h1>
    <p class="screen-sub">${fmtDuration(session.durationSecs)}</p>
    ${exerciseRows}
    <button type="button" class="btn btn-danger" id="deleteBtn" style="margin-top: 16px;">
      Delete this workout
    </button>
  `;

  container.querySelector('[data-action="back"]').addEventListener("click", () => {
    ctx.navigate("history");
  });

  container.querySelector("#deleteBtn").addEventListener("click", () => {
    const ok = window.confirm("Delete this workout? This can't be undone.");
    if (!ok) return;
    update((s) => ({ ...s, history: s.history.filter((h) => h.id !== sessionId) }));
    ctx.navigate("history");
  });
}
