// views/progress.js — per-exercise weight-over-time chart (inline SVG, no chart library)
// plus an Epley-estimated 1RM line and a best-set table.
import { estimate1RM } from "../calc.js";
import { fmtWeight, fmtDate, escapeHtml } from "../util.js";

const WEIGHT_COLOR = "var(--accent)";
const E1RM_COLOR = "var(--text-faint)";

export async function render(container, state, params, ctx) {
  const exercises = state.exercises;
  if (!exercises.length) {
    container.innerHTML = `<h1 class="screen-title">Progress</h1><div class="empty-state">Add some lifts first.</div>`;
    return;
  }

  const selectedId = params[0] && exercises.some((e) => e.id === params[0]) ? params[0] : exercises[0].id;

  const optionsHtml = exercises
    .map((e) => `<option value="${e.id}" ${e.id === selectedId ? "selected" : ""}>${escapeHtml(e.name)}</option>`)
    .join("");

  container.innerHTML = `
    <h1 class="screen-title">Progress</h1>
    <div class="field">
      <label for="exerciseSelect">Exercise</label>
      <select id="exerciseSelect">${optionsHtml}</select>
    </div>
    <div id="progressBody"></div>
  `;

  container.querySelector("#exerciseSelect").addEventListener("change", (e) => {
    ctx.navigate(`progress/${e.target.value}`);
  });

  container.querySelector("#progressBody").innerHTML = buildBody(state, selectedId);
}

function seriesFor(state, exerciseId) {
  // Oldest first — state.history is stored newest-first.
  const chrono = [...state.history].reverse();
  const points = [];
  for (const session of chrono) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry || !entry.sets.length) continue;
    const bestSet = entry.sets.reduce((a, b) => (b.reps > a.reps ? b : a), entry.sets[0]);
    points.push({
      date: session.date,
      weight: entry.targetWeight,
      e1rm: estimate1RM(entry.targetWeight, bestSet.reps),
      bestReps: bestSet.reps,
    });
  }
  return points;
}

function buildBody(state, exerciseId) {
  const points = seriesFor(state, exerciseId);
  const units = state.settings.units;

  if (points.length === 0) {
    return `<div class="empty-state">No sessions logged for this lift yet.</div>`;
  }

  const chartHtml = points.length >= 2 ? buildChart(points) : `
    <div class="card"><div class="card-sub">Log one more session to see a trend line.</div></div>
  `;

  const best = points.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), points[0]);
  const bestTableHtml = `
    <div class="card">
      <div class="card-title">Best set</div>
      <div class="card-row"><span class="card-sub">Date</span><span>${fmtDate(best.date)}</span></div>
      <div class="card-row"><span class="card-sub">Weight</span><span>${fmtWeight(best.weight, units)}</span></div>
      <div class="card-row"><span class="card-sub">Reps</span><span>${best.bestReps}</span></div>
      <div class="card-row"><span class="card-sub">Est. 1RM (Epley)</span><span>${fmtWeight(best.e1rm, units)}</span></div>
    </div>
  `;

  return `${chartHtml}${bestTableHtml}`;
}

function buildChart(points) {
  const W = 300, H = 140, PAD = 24;
  const values = points.flatMap((p) => [p.weight, p.e1rm]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xAt = (i) => PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
  const yAt = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);

  const weightPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.weight).toFixed(1)}`).join(" ");
  const e1rmPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.e1rm).toFixed(1)}`).join(" ");

  const weightDots = points
    .map((p, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.weight).toFixed(1)}" r="3" fill="${WEIGHT_COLOR}" />`)
    .join("");

  return `
    <div class="card">
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Weight and estimated 1RM over time">
        <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--border)" stroke-width="1" />
        <path d="${e1rmPath}" fill="none" stroke="${E1RM_COLOR}" stroke-width="1.5" stroke-dasharray="4 3" />
        <path d="${weightPath}" fill="none" stroke="${WEIGHT_COLOR}" stroke-width="2.5" />
        ${weightDots}
      </svg>
      <div class="card-row">
        <span class="card-sub"><span style="color:${WEIGHT_COLOR};">&#9632;</span> Working weight</span>
        <span class="card-sub"><span style="color:${E1RM_COLOR};">&#9632;</span> Est. 1RM</span>
      </div>
    </div>
  `;
}
