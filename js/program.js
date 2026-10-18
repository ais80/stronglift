// program.js — the 5x5 progression engine. Pure functions, no DOM, no localStorage:
// everything here takes plain data in and returns plain data out, so it can be
// exercised directly from js/test.html.

/**
 * Round `weight` to the nearest multiple of `step`.
 * mode: "nearest" (ties round up), "down", or "up".
 */
export function roundToStep(weight, step, mode = "nearest") {
  if (!step || step <= 0) return weight;
  const n = weight / step;
  let rounded;
  if (mode === "down") rounded = Math.floor(n + 1e-9);
  else if (mode === "up") rounded = Math.ceil(n - 1e-9);
  else rounded = Math.round(n);
  return round2(rounded * step);
}

/**
 * How many sets a "main slot" lift should do today, given the session's set scheme.
 * '3x5' caps at 3 sets to save time; it never *adds* sets (e.g. Deadlift's 1 stays 1),
 * and never applies to accessory add-ons — callers only use this for main-slot entries.
 */
export function effectiveSets(originalSets, scheme) {
  if (scheme === "3x5") return Math.min(originalSets, 3);
  return originalSets;
}

/**
 * Suggested starting weight for a machine-assisted equivalent of a free-bar lift (e.g.
 * a Smith machine) the first time it's swapped in: the linked lift's current weight
 * scaled up by the machine's load multiplier, rounded to the machine exercise's own
 * increment. Only meant to seed a sensible first weight — after that, the machine
 * exercise progresses independently like any other alternate, not derived from this
 * again.
 */
export function equivalentStartWeight(linkedWeight, loadMultiplier, step) {
  return roundToStep(linkedWeight * loadMultiplier, step);
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

/** A logged set is a hit if its reps met (or beat) the target. */
export function setHit(set) {
  return Number(set.reps) >= Number(set.target);
}

/** A logged exercise entry succeeds if every one of its sets hit its target. */
export function isSuccess(entry) {
  if (!entry || !Array.isArray(entry.sets) || entry.sets.length === 0) return false;
  return entry.sets.every(setHit);
}

/**
 * Decide the next working weight for one exercise after a session.
 * @param {object} exercise  from state.exercises (has .increment, .deloadFloor)
 * @param {object} progress  { currentWeight, consecutiveFailures }
 * @param {boolean} succeeded
 * @param {object} settings  { deloadPct, failuresBeforeDeload }
 * @returns {{ currentWeight: number, consecutiveFailures: number, deloaded: boolean }}
 */
export function nextWeight(exercise, progress, succeeded, settings) {
  const step = exercise.increment;

  if (succeeded) {
    return {
      currentWeight: round2(progress.currentWeight + step),
      consecutiveFailures: 0,
      deloaded: false,
    };
  }

  const consecutiveFailures = progress.consecutiveFailures + 1;
  if (consecutiveFailures < settings.failuresBeforeDeload) {
    return { currentWeight: progress.currentWeight, consecutiveFailures, deloaded: false };
  }

  // Hit the failure threshold: deload, rounding down to the nearest increment step.
  const reduced = progress.currentWeight * (1 - settings.deloadPct / 100);
  let deloadedWeight = roundToStep(reduced, step, "down");
  const floor = exercise.deloadFloor ?? 0;

  if (deloadedWeight < floor || deloadedWeight >= progress.currentWeight) {
    // Can't deload below the floor (or rounding produced no real drop) — leave it as is.
    return { currentWeight: progress.currentWeight, consecutiveFailures: 0, deloaded: false };
  }

  return { currentWeight: deloadedWeight, consecutiveFailures: 0, deloaded: true };
}

/** Assemble today's workout: each exercise for `day` at its current working weight. */
export function buildWorkout(day, state) {
  const ids = state.programDays[day] || [];
  return ids
    .map((id) => {
      const exercise = state.exercises.find((e) => e.id === id);
      if (!exercise) return null;
      const progress = state.progress[id] || {
        currentWeight: exercise.startWeight,
        consecutiveFailures: 0,
      };
      return {
        exerciseId: id,
        name: exercise.name,
        type: exercise.type,
        targetWeight: progress.currentWeight,
        setsReps: exercise.setsReps,
        warmupPreset: exercise.warmupPreset,
      };
    })
    .filter(Boolean);
}

/**
 * Apply a completed workout's logged entries to state: updates progress for each
 * exercise, appends a history record, and flips nextDay. Returns a new state object
 * (does not mutate the one passed in) — call state.save(result) to persist it.
 */
export function applyWorkoutResult(state, day, entries, durationSecs) {
  const progress = { ...state.progress };
  const historyEntries = [];

  for (const entry of entries) {
    const exercise = state.exercises.find((e) => e.id === entry.exerciseId);
    const prior = progress[entry.exerciseId] || {
      currentWeight: exercise.startWeight,
      consecutiveFailures: 0,
    };
    const success = isSuccess(entry);
    const result = nextWeight(exercise, prior, success, state.settings);
    progress[entry.exerciseId] = {
      currentWeight: result.currentWeight,
      consecutiveFailures: result.consecutiveFailures,
    };
    historyEntries.push({
      exerciseId: entry.exerciseId,
      targetWeight: entry.targetWeight,
      sets: entry.sets,
      success,
      deloaded: result.deloaded,
      nextWeight: result.currentWeight,
    });
  }

  const historyRecord = {
    id: `w_${Date.now()}`,
    date: new Date().toISOString(),
    day,
    entries: historyEntries,
    durationSecs: durationSecs || 0,
  };

  return {
    ...state,
    progress,
    history: [historyRecord, ...state.history],
    nextDay: day === "A" ? "B" : "A",
  };
}
