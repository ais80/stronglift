// views/workout.js — the live workout screen: the core loop of the app.
import { buildWorkout, applyWorkoutResult, effectiveSets, equivalentStartWeight, pendingItems, applyLoggedItems } from "../program.js";
import { platesFor, warmupSets } from "../calc.js";
import { save, update } from "../state.js";
import { fmtWeight, escapeHtml } from "../util.js";
import { ACCESSORY_IDS } from "../../data/seed.js";
import { backupAfterWorkout } from "../sync.js";
import * as timer from "../timer.js";
import * as restNotify from "../restNotify.js";

const DRAFT_KEY = "stronglift.workout.draft";
const LONG_PRESS_MS = 500;
// The draft lives in localStorage so a workout survives Android closing the app while
// the phone is locked. Drafts older than this are treated as abandoned.
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function loadDraft(day, state) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const fresh = parsed && Date.now() - parsed.startedAt < DRAFT_MAX_AGE_MS;
      if (fresh && parsed.day === day && Array.isArray(parsed.entries)) return parsed;
    }
  } catch (e) {
    console.warn("[workout] could not read draft, starting fresh:", e);
  }
  return buildDraft(day, state);
}

/** True once any set anywhere in the draft has a logged value — used to lock the
 *  scheme toggle and swap/remove affordances once a session is actually underway. */
function entryLocked(entry) {
  return entry.sets.some((s) => s.reps !== null);
}
function anyLogged(draft) {
  return draft.entries.some(entryLocked);
}

function makeEntry(exercise, state, { isMainSlot, swappedFrom }) {
  const progress = state.progress[exercise.id] || {
    currentWeight: exercise.startWeight,
    consecutiveFailures: 0,
  };
  const scheme = state.settings.defaultSetScheme;
  const sets = isMainSlot ? effectiveSets(exercise.setsReps.sets, scheme) : exercise.setsReps.sets;
  const warmups =
    exercise.type === "bodyweight"
      ? []
      : warmupSets(progress.currentWeight, state.settings.barWeight, exercise.increment).map((w) => ({
          ...w,
          done: false,
        }));
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    type: exercise.type,
    setsReps: exercise.setsReps, // the exercise's own declared scheme (reps target lives here)
    targetWeight: progress.currentWeight,
    increment: exercise.increment,
    warmupOn: true,
    warmups, // [{ weight, reps, done }] — logged for the record, never affect progression
    cue: exercise.cue || "",
    repUnit: exercise.repUnit || "reps",
    alternates: exercise.alternates || [],
    equivalentTo: exercise.equivalentTo || null, // e.g. Smith Squat -> "squat" — also progresses that lift
    isMainSlot,
    swappedFrom, // set when this slot was swapped from a main lift, for a small UI note
    sets: Array.from({ length: sets }, () => ({ reps: null })),
  };
}

function buildDraft(day, state) {
  const workout = buildWorkout(day, state);
  return {
    day,
    startedAt: Date.now(),
    entries: workout.map((w) => {
      const exercise = state.exercises.find((e) => e.id === w.exerciseId);
      return makeEntry(exercise, state, { isMainSlot: true });
    }),
  };
}

function persistDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    /* non-fatal: worst case a reload loses in-progress logging for this set */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    /* ignore */
  }
}

export async function render(container, state, params, ctx) {
  const day = params[0] === "A" || params[0] === "B" ? params[0] : state.nextDay;
  const draft = loadDraft(day, state);
  persistDraft(draft); // fixes its session id, which sets logged from the notification refer to
  const openTips = new Set(); // which exercise blocks have their cue expanded (ephemeral)

  container.innerHTML = `
    <div class="back-row">
      <button type="button" class="back-btn" data-action="back">&larr; Home</button>
    </div>
    <h1 class="screen-title">Workout ${day}</h1>
    <p class="screen-sub">Tap a set once you've done it. Tap it again to correct the reps.
      Hold a lift's name to swap in an alternative.</p>
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

  // ---- lock-screen notification (see restNotify.js / service-worker.js) ----
  function platesLabel(weight) {
    const plates = platesFor(weight, state.settings.barWeight, state.settings.plates);
    const text = plates.perSide.length
      ? plates.perSide.map((p) => `${trim(p.weight)}×${p.count}`).join(" + ") + " /side"
      : "bar only";
    return plates.exact ? text : `${text} (closest: ${fmtWeight(plates.achievedWeight, state.settings.units)})`;
  }

  /** Remaining sets in order, with the text the notification shows for each. */
  function buildQueue() {
    const units = state.settings.units;
    return pendingItems(draft.entries).map((it) => {
      const entry = draft.entries[it.exIdx];
      const base = { exIdx: it.exIdx, kind: it.kind, idx: it.idx, exerciseId: entry.exerciseId };
      if (it.kind === "warmup") {
        const w = entry.warmups[it.idx];
        return {
          ...base,
          reps: w.reps,
          restAfter: 0,
          actionTitle: "✓ Done",
          label: `${entry.name} · warm-up ${it.idx + 1}/${entry.warmups.length} · ${fmtWeight(w.weight, units)} × ${w.reps} · ${platesLabel(w.weight)}`,
        };
      }
      const target = entry.setsReps.reps;
      const unitWord = entry.repUnit === "seconds" ? "sec" : "reps";
      const load =
        entry.targetWeight > 0 ? `${fmtWeight(entry.targetWeight, units)} × ${target}` : `${target} ${unitWord}`;
      const plates = entry.type !== "bodyweight" ? ` · ${platesLabel(entry.targetWeight)}` : "";
      return {
        ...base,
        reps: target,
        restAfter: state.settings.restSecsMain, // the button logs a full (hit) set
        actionTitle: `✓ Done — ${target} ${unitWord}`,
        label: `${entry.name} · set ${it.idx + 1}/${entry.sets.length} · ${load}${plates}`,
      };
    });
  }

  function notifyInfo() {
    return {
      sessionId: draft.startedAt,
      endAt: timer.isRunning() ? timer.storedEndAt() : 0,
      queue: buildQueue(),
    };
  }

  /** Refresh the notification; `schedule` also has the service worker fire rest-over. */
  function syncNotification(schedule = false) {
    if (!restNotify.canNotify(state.settings)) return;
    restNotify.post("rest-show", { ...notifyInfo(), schedule });
  }

  function startRestTimer(seconds, { startedAt = Date.now(), notify = true } = {}) {
    const endAt = startedAt + seconds * 1000;
    timerBarEl.hidden = false;
    timer.setBeepEnabled(!!state.settings.soundOnTimerEnd);
    timer.startUntil(endAt, {
      onTick: (remaining) => {
        const el = timerBarEl.querySelector("#timerCount");
        if (el) el.textContent = timer.formatMMSS(remaining);
      },
      onDone: () => {
        timerBarEl.hidden = true;
        // Backup for the service worker's own alert; it ignores this if it already fired.
        if (restNotify.canNotify(state.settings)) {
          restNotify.post("rest-over", { ...notifyInfo(), endAt });
        }
      },
    });
    if (notify) syncNotification(true);
  }

  timerBarEl.querySelector("#skipRestBtn").addEventListener("click", () => {
    timer.stop();
    timerBarEl.hidden = true;
    syncNotification();
  });

  /** Apply sets logged from the notification while this page wasn't looking. */
  async function applyPending() {
    const actions = await restNotify.takePending();
    if (!actions.length) return;
    const applied = applyLoggedItems(draft, actions);
    if (!applied.length) return;
    persistDraft(draft);
    // The rest running now is the one started by the last logged set (the service
    // worker already put it on the notification). Restart the timer before repainting,
    // since the repaint refreshes the notification from the timer's state.
    const last = applied[applied.length - 1];
    const endAt = last.restAfter > 0 ? last.at + last.restAfter * 1000 : 0;
    if (endAt > Date.now()) {
      startRestTimer(last.restAfter, { startedAt: last.at, notify: false });
    } else {
      timer.stop();
      timerBarEl.hidden = true;
    }
    paintBody();
    toast(`Logged ${applied.length} set${applied.length > 1 ? "s" : ""} from the notification.`);
  }

  const stopPendingListener = restNotify.onPending(applyPending);
  const onVisible = () => {
    if (document.visibilityState === "visible") applyPending();
  };
  document.addEventListener("visibilitychange", onVisible);

  function cleanup() {
    timer.stop();
    timerBarEl.remove();
    closePicker();
    stopPendingListener();
    document.removeEventListener("visibilitychange", onVisible);
    restNotify.post("rest-clear");
    window.removeEventListener("hashchange", cleanup);
  }
  window.addEventListener("hashchange", cleanup);

  // ---- a small, reusable picker overlay (used for both swap and add-accessory) ----
  let pickerEl = null;
  function closePicker() {
    if (pickerEl) {
      pickerEl.remove();
      pickerEl = null;
    }
  }
  function openPicker({ title, sections, onPick }) {
    closePicker();
    const sectionsHtml = sections
      .filter((sec) => sec.items.length)
      .map(
        (sec) => `
        <div class="picker-section-label">${escapeHtml(sec.label)}</div>
        ${sec.items
          .map(
            (item) =>
              `<button type="button" class="btn picker-item" data-picker-id="${item.id}">${escapeHtml(item.name)}</button>`
          )
          .join("")}
      `
      )
      .join("");
    pickerEl = document.createElement("div");
    pickerEl.className = "picker-overlay";
    pickerEl.innerHTML = `
      <div class="picker-sheet">
        <div class="picker-title">${escapeHtml(title)}</div>
        ${sectionsHtml || `<div class="card-sub">Nothing else available.</div>`}
        <button type="button" class="btn btn-ghost" data-picker-cancel>Cancel</button>
      </div>
    `;
    pickerEl.addEventListener("click", (e) => {
      if (e.target === pickerEl || e.target.closest("[data-picker-cancel]")) {
        closePicker();
        return;
      }
      const btn = e.target.closest("[data-picker-id]");
      if (btn) {
        const id = btn.dataset.pickerId;
        closePicker();
        onPick(id);
      }
    });
    document.body.appendChild(pickerEl);
  }

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  // ---- swap (long-press) ----
  function openSwapPicker(exIdx) {
    const entry = draft.entries[exIdx];
    if (entryLocked(entry)) {
      toast("Already logged a set here — can't swap mid-session.");
      return;
    }
    const curatedIds = new Set(entry.alternates);
    const curated = entry.alternates
      .map((id) => state.exercises.find((e) => e.id === id))
      .filter(Boolean);
    const others = state.exercises.filter(
      (e) => e.id !== entry.exerciseId && !curatedIds.has(e.id) && !ACCESSORY_IDS.includes(e.id)
    );
    openPicker({
      title: `Swap ${entry.name} for…`,
      sections: [
        { label: "Suggested alternatives", items: curated },
        { label: "Other lifts", items: others },
      ],
      onPick: (newId) => performSwap(exIdx, newId),
    });
  }

  function performSwap(exIdx, newExerciseId) {
    const newEx = state.exercises.find((e) => e.id === newExerciseId);
    if (!newEx) return;
    const entry = draft.entries[exIdx];
    const swappedFrom = entry.swappedFrom || entry.exerciseId;

    // Machine-assisted equivalents (e.g. a Smith machine standing in for a free-bar
    // lift) get their first-ever working weight scaled off today's free-bar weight,
    // rather than whatever stale/default weight they'd otherwise start from — but only
    // the first time; once there's real performance on it, that's what drives things,
    // same as any other independently-tracked alternate.
    let scaledNote = null;
    if (newEx.equivalentTo && newEx.loadMultiplier) {
      const everUsed = state.history.some((h) => h.entries.some((e) => e.exerciseId === newEx.id));
      if (!everUsed) {
        const linkedWeight = (state.progress[newEx.equivalentTo] || {}).currentWeight;
        if (linkedWeight != null) {
          const suggested = equivalentStartWeight(linkedWeight, newEx.loadMultiplier, newEx.increment);
          state = update((s) => ({
            ...s,
            progress: { ...s.progress, [newEx.id]: { currentWeight: suggested, consecutiveFailures: 0 } },
          }));
          const linkedName = state.exercises.find((e) => e.id === newEx.equivalentTo)?.name || newEx.equivalentTo;
          scaledNote = `First time on this — started at ${fmtWeight(suggested, state.settings.units)} (${linkedName} × ${newEx.loadMultiplier}). Tune the multiplier in Lifts if it feels off.`;
        }
      }
    }

    draft.entries[exIdx] = makeEntry(newEx, state, { isMainSlot: true, swappedFrom });
    if (scaledNote) draft.entries[exIdx].scaledNote = scaledNote;
    persistDraft(draft);
    paintBody();
  }

  // ---- accessories (add-on, after the main lifts) ----
  function addAccessory(exerciseId) {
    if (draft.entries.some((e) => e.exerciseId === exerciseId)) return;
    const ex = state.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    draft.entries.push(makeEntry(ex, state, { isMainSlot: false }));
    persistDraft(draft);
    paintBody();
  }

  function removeEntry(exIdx) {
    const entry = draft.entries[exIdx];
    if (!entry || entry.isMainSlot || entryLocked(entry)) return;
    draft.entries.splice(exIdx, 1);
    persistDraft(draft);
    paintBody();
  }

  function openAddAccessoryPicker() {
    const presentIds = new Set(draft.entries.map((e) => e.exerciseId));
    const curated = ACCESSORY_IDS.filter((id) => !presentIds.has(id))
      .map((id) => state.exercises.find((e) => e.id === id))
      .filter(Boolean);
    const others = state.exercises.filter((e) => !presentIds.has(e.id) && !curated.includes(e));
    openPicker({
      title: "Add an exercise",
      sections: [
        { label: "Suggested accessories", items: curated },
        { label: "Everything else", items: others },
      ],
      onPick: (id) => addAccessory(id),
    });
  }

  // ---- set scheme (5x5 / 3x5) ----
  function setScheme(newScheme) {
    if (anyLogged(draft)) {
      toast("Can't change the scheme once a set's logged this session.");
      return;
    }
    if (state.settings.defaultSetScheme === newScheme) return;
    state = update((s) => ({ ...s, settings: { ...s.settings, defaultSetScheme: newScheme } }));
    for (const entry of draft.entries) {
      if (entry.isMainSlot) {
        const n = effectiveSets(entry.setsReps.sets, newScheme);
        entry.sets = Array.from({ length: n }, () => ({ reps: null }));
      }
    }
    persistDraft(draft);
    paintBody();
  }

  function paintBody() {
    bodyEl.innerHTML = buildBodyHtml(draft, state, openTips);
    syncNotification();
  }
  paintBody();

  // Resume a rest that was running when the app was closed, then pick up anything
  // logged from the notification in the meantime.
  if (timer.storedEndAt() > Date.now()) {
    startRestTimer((timer.storedEndAt() - Date.now()) / 1000);
  }
  applyPending();

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
      const unitWord = entry.repUnit === "seconds" ? "seconds" : "reps";

      if (set.reps === null) {
        // First tap: assume the common case — a full, successful set.
        set.reps = entry.setsReps.reps;
        onSetLogged(entry, set);
      } else {
        // Already logged: offer to correct it (this is how a miss gets recorded).
        const answer = window.prompt(
          `${unitWord[0].toUpperCase()}${unitWord.slice(1)} completed — ${entry.name}, set ${setIdx + 1} (target ${entry.setsReps.reps}). Leave blank to clear.`,
          String(set.reps)
        );
        if (answer === null) return; // cancelled
        if (answer.trim() === "") {
          set.reps = null;
        } else {
          const n = parseInt(answer, 10);
          if (!Number.isNaN(n)) {
            set.reps = Math.max(0, Math.min(999, n));
            onSetLogged(entry, set);
          }
        }
      }
      persistDraft(draft);
      paintBody();
      return;
    }

    const warmupBtn = e.target.closest('[data-action="warmup-cell"]');
    if (warmupBtn) {
      const w = draft.entries[Number(warmupBtn.dataset.ex)].warmups[Number(warmupBtn.dataset.w)];
      w.done = !w.done;
      persistDraft(draft);
      paintBody();
      return;
    }

    const tipsBtn = e.target.closest('[data-action="toggle-tips"]');
    if (tipsBtn) {
      const exIdx = Number(tipsBtn.dataset.ex);
      if (openTips.has(exIdx)) openTips.delete(exIdx);
      else openTips.add(exIdx);
      paintBody();
      return;
    }

    const removeBtn = e.target.closest('[data-action="remove-entry"]');
    if (removeBtn) {
      removeEntry(Number(removeBtn.dataset.ex));
      return;
    }

    const addAccessoryBtn = e.target.closest('[data-action="add-accessory"]');
    if (addAccessoryBtn) {
      openAddAccessoryPicker();
      return;
    }

    const schemeBtn = e.target.closest('[data-action="set-scheme"]');
    if (schemeBtn) {
      setScheme(schemeBtn.dataset.scheme);
      return;
    }

    const finishBtn = e.target.closest('[data-action="finish"]');
    if (finishBtn) {
      const entries = draft.entries.map((entry) => ({
        exerciseId: entry.exerciseId,
        targetWeight: entry.targetWeight,
        sets: entry.sets.map((s) => ({ reps: s.reps ?? 0, target: entry.setsReps.reps })),
        warmups: (entry.warmups || []).filter((w) => w.done).map(({ weight, reps }) => ({ weight, reps })),
      }));
      const durationSecs = Math.round((Date.now() - draft.startedAt) / 1000);
      const next = applyWorkoutResult(state, day, entries, durationSecs);
      save(next);
      clearDraft();
      restNotify.clearPending();
      cleanup();
      if (next.settings.autoSyncAfterWorkout && next.settings.syncServerUrl) {
        // If the T620 isn't reachable right now (e.g. off Tailscale), the backup stays
        // queued and retries automatically until it lands (see sync.js).
        backupAfterWorkout(next.settings).then((ok) =>
          toast(ok ? "Synced to T620." : "Saved. It'll back up to the T620 once it's reachable.")
        );
      }
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

  // ---- long-press to swap: pointer-based, so it works for touch and mouse ----
  let longPressTimer = null;
  let longPressExIdx = null;

  function clearLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressExIdx = null;
  }

  bodyEl.addEventListener("pointerdown", (e) => {
    const head = e.target.closest("[data-swap-head]");
    if (!head) return;
    const exIdx = Number(head.dataset.ex);
    longPressExIdx = exIdx;
    longPressTimer = setTimeout(() => {
      if (longPressExIdx !== exIdx) return;
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(30);
        } catch (err) {
          /* ignore */
        }
      }
      openSwapPicker(exIdx);
      clearLongPress();
    }, LONG_PRESS_MS);
  });
  ["pointerup", "pointercancel", "pointerleave", "pointermove"].forEach((evt) => {
    bodyEl.addEventListener(evt, () => clearLongPress());
  });
  bodyEl.addEventListener("contextmenu", (e) => {
    if (e.target.closest("[data-swap-head]")) e.preventDefault();
  });

  container.querySelector('[data-action="back"]').addEventListener("click", () => {
    cleanup();
    ctx.navigate("home");
  });
}

function buildSchemeToggleHtml(draft, state) {
  const scheme = state.settings.defaultSetScheme;
  const locked = anyLogged(draft);
  return `
    <div class="scheme-toggle ${locked ? "locked" : ""}">
      <button type="button" class="scheme-btn ${scheme === "5x5" ? "active" : ""}"
        data-action="set-scheme" data-scheme="5x5" ${locked ? "disabled" : ""}>5&times;5</button>
      <button type="button" class="scheme-btn ${scheme === "3x5" ? "active" : ""}"
        data-action="set-scheme" data-scheme="3x5" ${locked ? "disabled" : ""}>3&times;5 (faster)</button>
    </div>
  `;
}

function buildBodyHtml(draft, state, openTips) {
  const mainBlocks = draft.entries
    .filter((e) => e.isMainSlot)
    .map((entry) => buildExerciseBlockHtml(entry, draft.entries.indexOf(entry), state, openTips))
    .join("");

  const accessoryEntries = draft.entries.filter((e) => !e.isMainSlot);
  const accessoryBlocks = accessoryEntries
    .map((entry) => buildExerciseBlockHtml(entry, draft.entries.indexOf(entry), state, openTips))
    .join("");

  return `
    ${buildSchemeToggleHtml(draft, state)}
    ${mainBlocks}
    <div class="card accessory-card">
      <div class="card-title">Optional — if you have time</div>
      ${accessoryBlocks}
      <button type="button" class="btn" data-action="add-accessory">+ Add an exercise</button>
    </div>
    <div class="btn-row" style="margin-top: 20px;">
      <button type="button" class="btn btn-primary" data-action="finish">Finish workout</button>
    </div>`;
}

function buildExerciseBlockHtml(entry, exIdx, state, openTips) {
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

    const warmups = entry.warmupOn ? entry.warmups || [] : [];
    warmupHtml = warmups.length
      ? `<div class="warmup-list">${warmups
          .map(
            (w, wIdx) => `<button type="button" class="warmup-cell ${w.done ? "done" : ""}" data-action="warmup-cell" data-ex="${exIdx}" data-w="${wIdx}">
              <span class="warmup-load">${fmtWeight(w.weight, state.settings.units)} &times; ${w.reps}</span>
              <span class="warmup-plates">${escapeHtml(warmupPlates(w.weight, state))}</span>
              <span class="warmup-check">${w.done ? "✓" : ""}</span>
            </button>`
          )
          .join("")}</div>`
      : "";
  }

  const unitLabel = entry.repUnit === "seconds" ? "sec" : "reps";
  const setsHtml = entry.sets
    .map((s, setIdx) => {
      const cls = s.reps === null ? "" : s.reps >= entry.setsReps.reps ? "done" : "missed";
      const label = s.reps === null ? entry.setsReps.reps : s.reps;
      return `<button type="button" class="set-cell ${cls}" data-action="set-cell" data-ex="${exIdx}" data-set="${setIdx}">
        <span>${label}</span><span class="set-reps-label">${unitLabel}</span>
      </button>`;
    })
    .join("");

  const swapNote = entry.swappedFrom
    ? `<div class="card-sub swap-note">Standing in for ${escapeHtml(
        state.exercises.find((e) => e.id === entry.swappedFrom)?.name || entry.swappedFrom
      )} today${
        entry.equivalentTo
          ? ` — hitting these sets also progresses ${escapeHtml(
              state.exercises.find((e) => e.id === entry.equivalentTo)?.name || entry.equivalentTo
            )}`
          : ""
      }</div>`
    : "";
  const scaledNoteHtml = entry.scaledNote
    ? `<div class="card-sub swap-note">${escapeHtml(entry.scaledNote)}</div>`
    : "";

  const tipsOpen = openTips.has(exIdx);
  const tipsHtml = entry.cue
    ? `<button type="button" class="tips-toggle" data-action="toggle-tips" data-ex="${exIdx}">
         ${tipsOpen ? "ⓘ Hide tips" : "ⓘ Tips"}
       </button>
       ${tipsOpen ? `<div class="tips-text">${escapeHtml(entry.cue)}</div>` : ""}`
    : "";

  const removeBtn = !entry.isMainSlot && !entryLocked(entry)
    ? `<button type="button" class="btn btn-ghost accessory-remove" data-action="remove-entry" data-ex="${exIdx}" style="width:auto;">Remove</button>`
    : "";

  return `<div class="exercise-block">
    <div class="exercise-head" ${entry.isMainSlot ? `data-swap-head data-ex="${exIdx}"` : ""}>
      <span class="exercise-name">${escapeHtml(entry.name)}</span>
      <span class="exercise-weight">${fmtWeight(entry.targetWeight, state.settings.units)}</span>
    </div>
    ${swapNote}
    ${scaledNoteHtml}
    ${tipsHtml}
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
    ${removeBtn}
  </div>`;
}

function warmupPlates(weight, state) {
  const plates = platesFor(weight, state.settings.barWeight, state.settings.plates);
  return plates.perSide.length
    ? plates.perSide.map((p) => `${trim(p.weight)}×${p.count}`).join(" + ") + " /side"
    : "Bar only";
}

function trim(n) {
  return Number(n.toFixed(2)).toString();
}
