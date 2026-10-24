// views/settings.js — units/plates/increments/timers/theme, JSON export/import, reset.
import { update, exportJSON, importJSON, resetAll } from "../state.js";
import { backupToServer, restoreFromServer } from "../sync.js";
import { escapeHtml } from "../util.js";
import * as timer from "../timer.js";

const LB_PER_KG = 2.20462;

/** Convert every stored weight value (settings, exercises, progress, history) between units. */
function convertAllWeights(state, fromUnits, toUnits) {
  if (fromUnits === toUnits) return state;
  const factor = toUnits === "lb" ? LB_PER_KG : 1 / LB_PER_KG;
  const conv = (w) => Math.round(w * factor * 2) / 2; // nearest half-unit — practical for plates

  return {
    ...state,
    settings: {
      ...state.settings,
      units: toUnits,
      barWeight: conv(state.settings.barWeight),
      plates: state.settings.plates.map((p) => ({ ...p, weight: conv(p.weight) })),
      incrementUpper: conv(state.settings.incrementUpper),
      incrementLower: conv(state.settings.incrementLower),
    },
    exercises: state.exercises.map((ex) => ({
      ...ex,
      startWeight: conv(ex.startWeight),
      increment: conv(ex.increment),
      deloadFloor: ex.deloadFloor != null ? conv(ex.deloadFloor) : ex.deloadFloor,
    })),
    progress: Object.fromEntries(
      Object.entries(state.progress).map(([id, p]) => [id, { ...p, currentWeight: conv(p.currentWeight) }])
    ),
    history: state.history.map((h) => ({
      ...h,
      entries: h.entries.map((e) => ({
        ...e,
        targetWeight: conv(e.targetWeight),
        nextWeight: e.nextWeight != null ? conv(e.nextWeight) : e.nextWeight,
      })),
    })),
  };
}

export async function render(container, state, params, ctx) {
  container.innerHTML = buildHtml(state);
  wireEvents(container, state, ctx);
}

function buildHtml(state) {
  const s = state.settings;
  const platesRows = s.plates
    .map(
      (p, i) => `<div class="field-row" data-plate-row="${i}">
        <div class="field"><label>Plate (${s.units})</label><input type="number" step="0.25" min="0" data-plate-field="weight" data-plate-idx="${i}" value="${p.weight}"></div>
        <div class="field"><label>Count owned</label><input type="number" min="0" data-plate-field="count" data-plate-idx="${i}" value="${p.count}"></div>
        <button type="button" class="btn btn-ghost" style="width:auto;align-self:flex-end;" data-action="remove-plate" data-plate-idx="${i}">&times;</button>
      </div>`
    )
    .join("");

  return `
    <h1 class="screen-title">Settings</h1>

    <div class="card">
      <div class="card-title">Units</div>
      <div class="field">
        <select id="unitsSelect">
          <option value="kg" ${s.units === "kg" ? "selected" : ""}>Kilograms (kg)</option>
          <option value="lb" ${s.units === "lb" ? "selected" : ""}>Pounds (lb)</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Bar & increments</div>
      <div class="field-row">
        <div class="field"><label>Bar weight</label><input type="number" step="0.5" min="0" id="barWeight" value="${s.barWeight}"></div>
        <div class="field"><label>Upper-body increment</label><input type="number" step="0.25" min="0" id="incrementUpper" value="${s.incrementUpper}"></div>
        <div class="field"><label>Lower-body increment</label><input type="number" step="0.25" min="0" id="incrementLower" value="${s.incrementLower}"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Default set scheme</div>
      <div class="card-sub" style="margin-bottom:10px;">
        3&times;5 shortens Squat/Bench/Row/Press to 3 sets to save time &mdash; Deadlift and
        accessories are unaffected. Overridable per session from Home or Workout.
      </div>
      <div class="field">
        <select id="defaultSetScheme">
          <option value="5x5" ${s.defaultSetScheme === "5x5" ? "selected" : ""}>5&times;5</option>
          <option value="3x5" ${s.defaultSetScheme === "3x5" ? "selected" : ""}>3&times;5 (faster)</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Plates on hand</div>
      <div class="card-sub" style="margin-bottom:10px;">Count is both sides combined.</div>
      <div id="platesList">${platesRows}</div>
      <button type="button" class="btn" id="addPlateBtn" style="margin-top:8px;">+ Add plate size</button>
    </div>

    <div class="card">
      <div class="card-title">Deload</div>
      <div class="field-row">
        <div class="field"><label>Failures before deload</label><input type="number" min="1" id="failuresBeforeDeload" value="${s.failuresBeforeDeload}"></div>
        <div class="field"><label>Deload %</label><input type="number" min="1" max="50" id="deloadPct" value="${s.deloadPct}"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Rest timer</div>
      <div class="field-row">
        <div class="field"><label>After a hit (sec)</label><input type="number" min="0" id="restSecsMain" value="${s.restSecsMain}"></div>
        <div class="field"><label>After a miss (sec)</label><input type="number" min="0" id="restSecsLast" value="${s.restSecsLast}"></div>
      </div>
      <label class="switch-row">
        <span>Beep when rest ends <span class="card-sub">(can dip music — leave off)</span></span>
        <input type="checkbox" id="soundOnTimerEnd" ${s.soundOnTimerEnd ? "checked" : ""}>
      </label>
      <label class="switch-row">
        <span>Lock-screen workout notification (next set, rest timer, &check; Done button; buzzes the watch)</span>
        <input type="checkbox" id="notifyOnTimerEnd" ${s.notifyOnTimerEnd ? "checked" : ""}>
      </label>
      <div class="card-sub">Alerts only vibrate and never pause YT Music. To stop Android dipping the
        music at rest-over, set StrongLift's notification sound to Silent and leave vibration on
        (phone Settings &rarr; Notifications &rarr; App notifications &rarr; StrongLift).</div>
    </div>

    <div class="card">
      <div class="card-title">Appearance</div>
      <div class="field">
        <select id="themeSelect">
          <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Dark</option>
          <option value="light" ${s.theme === "light" ? "selected" : ""}>Light</option>
          <option value="auto" ${s.theme === "auto" ? "selected" : ""}>Match system</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div class="card-title">T620 sync</div>
      <div class="card-sub" style="margin-bottom:10px;">
        Backs up/restores over your own network (Tailscale). Your phone needs Tailscale
        connected for this to reach it. See <code>server/README.md</code> in the repo for
        how to deploy the server.
        <br><br>
        <strong>First try will likely fail with "Failed to fetch"</strong> — that's
        Chrome's own "Local network access" permission (same idea as camera/location),
        not a bug. Allow it when prompted, or set it manually: tap the icon next to the
        address bar → Permissions → Local network access → Allow, then try again.
      </div>
      <div class="field">
        <label>Server URL</label>
        <input type="text" id="syncServerUrl" placeholder="https://t620.tail76b543.ts.net:9453" value="${escapeHtml(s.syncServerUrl)}">
      </div>
      <div class="field">
        <label>API key</label>
        <input type="text" id="syncApiKey" value="${escapeHtml(s.syncApiKey)}">
      </div>
      <label class="switch-row">
        <span>Auto-sync after finishing a workout</span>
        <input type="checkbox" id="autoSyncAfterWorkout" ${s.autoSyncAfterWorkout ? "checked" : ""}>
      </label>
      <div class="btn-row" style="margin-top:10px;">
        <button type="button" class="btn" id="syncBackupBtn">Backup now</button>
        <button type="button" class="btn" id="syncRestoreBtn">Restore from T620</button>
      </div>
      <div id="syncStatus" class="card-sub" style="margin-top:8px;"></div>
    </div>

    <div class="card">
      <div class="card-title">Your data</div>
      <div class="btn-row">
        <button type="button" class="btn" id="exportBtn">Export JSON</button>
        <button type="button" class="btn" id="importBtn">Import JSON</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden>
      <button type="button" class="btn btn-danger" id="resetBtn" style="margin-top:10px;">Reset all data</button>
    </div>
  `;
}

function wireEvents(container, state, ctx) {
  const reRender = () => render(container, state, [], ctx);

  container.querySelector("#unitsSelect").addEventListener("change", (e) => {
    state = update((s) => convertAllWeights(s, s.settings.units, e.target.value));
    reRender();
  });

  bindNumber(container, "#barWeight", (v) => update((s) => ({ ...s, settings: { ...s.settings, barWeight: v } })));
  bindNumber(container, "#incrementUpper", (v) => update((s) => ({ ...s, settings: { ...s.settings, incrementUpper: v } })));
  bindNumber(container, "#incrementLower", (v) => update((s) => ({ ...s, settings: { ...s.settings, incrementLower: v } })));
  bindNumber(container, "#failuresBeforeDeload", (v) => update((s) => ({ ...s, settings: { ...s.settings, failuresBeforeDeload: Math.max(1, Math.round(v)) } })));
  bindNumber(container, "#deloadPct", (v) => update((s) => ({ ...s, settings: { ...s.settings, deloadPct: v } })));
  bindNumber(container, "#restSecsMain", (v) => update((s) => ({ ...s, settings: { ...s.settings, restSecsMain: Math.max(0, Math.round(v)) } })));
  bindNumber(container, "#restSecsLast", (v) => update((s) => ({ ...s, settings: { ...s.settings, restSecsLast: Math.max(0, Math.round(v)) } })));

  container.querySelector("#defaultSetScheme").addEventListener("change", (e) => {
    state = update((s) => ({ ...s, settings: { ...s.settings, defaultSetScheme: e.target.value } }));
  });

  container.querySelector("#syncServerUrl").addEventListener("change", (e) => {
    state = update((s) => ({ ...s, settings: { ...s.settings, syncServerUrl: e.target.value.trim() } }));
  });
  container.querySelector("#syncApiKey").addEventListener("change", (e) => {
    state = update((s) => ({ ...s, settings: { ...s.settings, syncApiKey: e.target.value.trim() } }));
  });
  container.querySelector("#autoSyncAfterWorkout").addEventListener("change", (e) => {
    state = update((s) => ({ ...s, settings: { ...s.settings, autoSyncAfterWorkout: e.target.checked } }));
  });

  const syncStatus = container.querySelector("#syncStatus");
  container.querySelector("#syncBackupBtn").addEventListener("click", async (e) => {
    const btn = e.target;
    btn.disabled = true;
    syncStatus.textContent = "Backing up…";
    try {
      await backupToServer(state.settings);
      syncStatus.textContent = "Backed up just now.";
    } catch (err) {
      syncStatus.textContent = `Backup failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
  container.querySelector("#syncRestoreBtn").addEventListener("click", async (e) => {
    const ok = window.confirm("Replace everything on this device with the T620's backup? This can't be undone.");
    if (!ok) return;
    const btn = e.target;
    btn.disabled = true;
    syncStatus.textContent = "Restoring…";
    try {
      const result = await restoreFromServer(state.settings);
      if (result.ok) {
        window.alert("Restore complete.");
        location.reload();
      } else {
        syncStatus.textContent = result.error || "Restore failed.";
      }
    } catch (err) {
      syncStatus.textContent = `Restore failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  container.querySelector("#soundOnTimerEnd").addEventListener("change", (e) => {
    state = update((s) => ({ ...s, settings: { ...s.settings, soundOnTimerEnd: e.target.checked } }));
    timer.setBeepEnabled(e.target.checked);
  });

  container.querySelector("#notifyOnTimerEnd").addEventListener("change", async (e) => {
    const checkbox = e.target;
    if (!checkbox.checked) {
      state = update((s) => ({ ...s, settings: { ...s.settings, notifyOnTimerEnd: false } }));
      return;
    }
    // Lazy permission request — only ever from this explicit user gesture, never on load.
    const result = await timer.requestNotificationPermission();
    if (result === "granted") {
      state = update((s) => ({ ...s, settings: { ...s.settings, notifyOnTimerEnd: true } }));
    } else {
      checkbox.checked = false;
      window.alert(
        result === "unsupported"
          ? "Notifications aren't supported in this browser."
          : "Notifications were blocked. You can allow them in your browser's site settings."
      );
    }
  });

  container.querySelector("#themeSelect").addEventListener("change", (e) => {
    const value = e.target.value;
    state = update((s) => ({ ...s, settings: { ...s.settings, theme: value } }));
    if (value === "dark" || value === "light") {
      document.documentElement.setAttribute("data-theme", value);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  // Plates
  container.querySelector("#platesList").addEventListener("change", (e) => {
    const field = e.target.closest("[data-plate-field]");
    if (!field) return;
    const idx = Number(field.dataset.plateIdx);
    const key = field.dataset.plateField;
    const value = Math.max(0, Number(field.value) || 0);
    state = update((s) => {
      const next = s.settings.plates.map((p, i) => (i === idx ? { ...p, [key]: value } : p));
      return { ...s, settings: { ...s.settings, plates: next } };
    });
  });

  container.querySelector("#platesList").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="remove-plate"]');
    if (!btn) return;
    const idx = Number(btn.dataset.plateIdx);
    state = update((s) => ({
      ...s,
      settings: { ...s.settings, plates: s.settings.plates.filter((_, i) => i !== idx) },
    }));
    reRender();
  });

  container.querySelector("#addPlateBtn").addEventListener("click", () => {
    const weightStr = window.prompt(`New plate weight (${state.settings.units}):`, "5");
    if (!weightStr) return;
    const weight = Number(weightStr);
    if (!weight || weight <= 0) return;
    state = update((s) => ({
      ...s,
      settings: { ...s.settings, plates: [...s.settings.plates, { weight, count: 2 }] },
    }));
    reRender();
  });

  // Data management
  container.querySelector("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stronglift-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const fileInput = container.querySelector("#importFile");
  container.querySelector("#importBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importJSON(String(reader.result));
      if (result.ok) {
        window.alert("Import complete.");
        location.reload();
      } else {
        window.alert(result.error || "Import failed.");
      }
    };
    reader.readAsText(file);
  });

  container.querySelector("#resetBtn").addEventListener("click", () => {
    const ok = window.confirm("Reset ALL data — exercises, history, and settings? This can't be undone.");
    if (!ok) return;
    resetAll();
    location.reload();
  });
}

function bindNumber(container, selector, onChange) {
  container.querySelector(selector).addEventListener("change", (e) => {
    const v = Number(e.target.value);
    if (Number.isNaN(v)) return;
    onChange(v);
  });
}
