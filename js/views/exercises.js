// views/exercises.js — edit lifts (name, weight, increment, sets x reps), add/remove custom lifts.
import { update } from "../state.js";
import { escapeHtml } from "../util.js";

export async function render(container, state, params, ctx) {
  container.innerHTML = `
    <h1 class="screen-title">Lifts</h1>
    <p class="screen-sub">Editing weight here sets what you'll lift next session.</p>
    <div id="exList"></div>
    <button type="button" class="btn" id="addBtn" style="margin-top: 8px;">+ Add a lift</button>
  `;

  const listEl = container.querySelector("#exList");

  function paint() {
    listEl.innerHTML = state.exercises.map((ex, idx) => renderCard(ex, idx, state)).join("");
  }
  paint();

  listEl.addEventListener("change", (e) => {
    const field = e.target.closest("[data-field]");
    if (!field) return;
    const idx = Number(field.dataset.idx);
    const key = field.dataset.field;
    let value = field.value;

    state = update((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[idx] };

      if (key === "name") {
        ex.name = value.trim() || ex.name;
      } else if (key === "type") {
        ex.type = value;
      } else if (key === "increment") {
        ex.increment = Math.max(0.5, Number(value) || ex.increment);
      } else if (key === "sets") {
        ex.setsReps = { ...ex.setsReps, sets: Math.max(1, parseInt(value, 10) || ex.setsReps.sets) };
      } else if (key === "reps") {
        ex.setsReps = { ...ex.setsReps, reps: Math.max(1, parseInt(value, 10) || ex.setsReps.reps) };
      } else if (key === "weight") {
        const w = Math.max(0, Number(value) || 0);
        ex.startWeight = w;
        const progress = { ...s.progress, [ex.id]: { ...(s.progress[ex.id] || { consecutiveFailures: 0 }), currentWeight: w } };
        exercises[idx] = ex;
        return { ...s, exercises, progress };
      }

      exercises[idx] = ex;
      return { ...s, exercises };
    });
    paint();
  });

  listEl.addEventListener("click", (e) => {
    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      const idx = Number(delBtn.dataset.idx);
      const ex = state.exercises[idx];
      const ok = window.confirm(`Delete "${ex.name}"? Its history stays, but it leaves your program.`);
      if (!ok) return;
      state = update((s) => {
        const exercises = s.exercises.filter((_, i) => i !== idx);
        const programDays = {
          A: s.programDays.A.filter((id) => id !== ex.id),
          B: s.programDays.B.filter((id) => id !== ex.id),
        };
        return { ...s, exercises, programDays };
      });
      paint();
    }
  });

  container.querySelector("#addBtn").addEventListener("click", () => {
    const name = window.prompt("Name this lift:");
    if (!name || !name.trim()) return;
    const id = `custom_${Date.now()}`;
    state = update((s) => {
      const exercise = {
        id,
        name: name.trim(),
        type: "barbell",
        startWeight: s.settings.barWeight,
        increment: s.settings.incrementUpper,
        setsReps: { sets: 5, reps: 5 },
        warmupPreset: "bar_main",
        deloadFloor: s.settings.barWeight,
      };
      const progress = { ...s.progress, [id]: { currentWeight: exercise.startWeight, consecutiveFailures: 0 } };
      return { ...s, exercises: [...s.exercises, exercise], progress };
    });
    paint();
  });
}

function renderCard(ex, idx, state) {
  const progress = state.progress[ex.id] || { currentWeight: ex.startWeight };
  return `<div class="card">
    <div class="field">
      <label>Name</label>
      <input type="text" data-field="name" data-idx="${idx}" value="${escapeHtml(ex.name)}">
    </div>
    <div class="field-row">
      <div class="field">
        <label>Weight (${state.settings.units})</label>
        <input type="number" step="0.5" min="0" data-field="weight" data-idx="${idx}" value="${progress.currentWeight}">
      </div>
      <div class="field">
        <label>Increment</label>
        <input type="number" step="0.5" min="0.5" data-field="increment" data-idx="${idx}" value="${ex.increment}">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Sets</label>
        <input type="number" min="1" data-field="sets" data-idx="${idx}" value="${ex.setsReps.sets}">
      </div>
      <div class="field">
        <label>Reps</label>
        <input type="number" min="1" data-field="reps" data-idx="${idx}" value="${ex.setsReps.reps}">
      </div>
      <div class="field">
        <label>Type</label>
        <select data-field="type" data-idx="${idx}">
          <option value="barbell" ${ex.type === "barbell" ? "selected" : ""}>Barbell</option>
          <option value="bodyweight" ${ex.type === "bodyweight" ? "selected" : ""}>Bodyweight</option>
        </select>
      </div>
    </div>
    <button type="button" class="btn btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
  </div>`;
}
