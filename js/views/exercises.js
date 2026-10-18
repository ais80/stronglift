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
      } else if (key === "cue") {
        ex.cue = value;
      } else if (key === "loadMultiplier") {
        const m = Number(value);
        ex.loadMultiplier = m > 0 ? m : null;
      }

      exercises[idx] = ex;
      return { ...s, exercises };
    });
    paint();
  });

  listEl.addEventListener("click", (e) => {
    const altBtn = e.target.closest('[data-action="edit-alternates"]');
    if (altBtn) {
      const idx = Number(altBtn.dataset.idx);
      const ex = state.exercises[idx];
      const otherNames = state.exercises.filter((e2) => e2.id !== ex.id).map((e2) => e2.name);
      const current = (ex.alternates || [])
        .map((id) => state.exercises.find((e2) => e2.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      const answer = window.prompt(
        `Alternates for ${ex.name} — comma-separated, matched against your lift names.\n` +
          `Available: ${otherNames.join(", ")}`,
        current
      );
      if (answer === null) return;
      const wanted = answer
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      state = update((s) => {
        const exercises = s.exercises.map((e2, i) => {
          if (i !== idx) return e2;
          const alternates = s.exercises
            .filter((cand) => cand.id !== e2.id && wanted.includes(cand.name.toLowerCase()))
            .map((cand) => cand.id);
          return { ...e2, alternates };
        });
        return { ...s, exercises };
      });
      paint();
      return;
    }

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
        alternates: [],
        cue: "",
        repUnit: "reps",
        equivalentTo: null,
        loadMultiplier: null,
      };
      const progress = { ...s.progress, [id]: { currentWeight: exercise.startWeight, consecutiveFailures: 0 } };
      return { ...s, exercises: [...s.exercises, exercise], progress };
    });
    paint();
  });
}

function renderCard(ex, idx, state) {
  const progress = state.progress[ex.id] || { currentWeight: ex.startWeight };
  const altNames = (ex.alternates || [])
    .map((id) => state.exercises.find((e2) => e2.id === id)?.name)
    .filter(Boolean)
    .join(", ");
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
    <div class="field">
      <label>Form cue (shown as "Tips" during a workout)</label>
      <input type="text" data-field="cue" data-idx="${idx}" value="${escapeHtml(ex.cue || "")}" placeholder="e.g. Brace your core, keep your chest up&hellip;">
    </div>
    ${
      ex.equivalentTo
        ? `<div class="field">
      <label>Load multiplier vs ${escapeHtml(state.exercises.find((e2) => e2.id === ex.equivalentTo)?.name || ex.equivalentTo)}
        (first-time starting weight only, then progresses on its own)</label>
      <input type="number" step="0.05" min="0.5" max="3" data-field="loadMultiplier" data-idx="${idx}" value="${ex.loadMultiplier ?? ""}">
    </div>`
        : ""
    }
    <div class="field">
      <label>Alternates (swap-in options when long-pressed during a workout)</label>
      <div class="card-row">
        <span class="card-sub">${altNames ? escapeHtml(altNames) : "None set"}</span>
        <button type="button" class="btn btn-ghost" style="width:auto;" data-action="edit-alternates" data-idx="${idx}">Edit</button>
      </div>
    </div>
    <button type="button" class="btn btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
  </div>`;
}
