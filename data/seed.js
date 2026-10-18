// seed.js — default program, exercises, and settings for a first run.
// Numbers here are the generic, standard 5x5 parameters (see BUILD_PLAN.md "Phase R"
// table) — not anything copied from a specific app's source or assets.

export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    units: "kg",
    barWeight: 20,
    // Total plates owned (both sides combined); per-side availability = floor(count/2).
    plates: [
      { weight: 25, count: 2 },
      { weight: 20, count: 2 },
      { weight: 15, count: 2 },
      { weight: 10, count: 4 },
      { weight: 5, count: 4 },
      { weight: 2.5, count: 4 },
      { weight: 1.25, count: 2 },
    ],
    incrementUpper: 2.5, // squat / bench / row / overhead press
    incrementLower: 5, // deadlift
    deloadPct: 10,
    failuresBeforeDeload: 3,
    restSecsMain: 180, // on a successful set
    restSecsLast: 300, // after a missed set
    theme: "dark", // 'dark' | 'light' — unset lets prefers-color-scheme decide
    soundOnTimerEnd: false, // off by default — vibration + notification are the primary alert
    notifyOnTimerEnd: false, // off until the user opts in from Settings (requests permission there)
  };
}

// warmupPreset: 'bar_main' (squat/bench/press — starts from two empty-bar sets)
//              'bar_pull' (row/deadlift — no empty-bar sets)
export function defaultExercises(barWeight = 20) {
  return [
    {
      id: "squat",
      name: "Squat",
      type: "barbell",
      startWeight: barWeight,
      increment: 2.5,
      setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main",
      deloadFloor: 20,
    },
    {
      id: "bench",
      name: "Bench Press",
      type: "barbell",
      startWeight: barWeight,
      increment: 2.5,
      setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main",
      deloadFloor: 20,
    },
    {
      id: "row",
      name: "Barbell Row",
      type: "barbell",
      startWeight: barWeight,
      increment: 2.5,
      setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_pull",
      deloadFloor: 30,
    },
    {
      id: "press",
      name: "Overhead Press",
      type: "barbell",
      startWeight: barWeight,
      increment: 2.5,
      setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main",
      deloadFloor: 20,
    },
    {
      id: "deadlift",
      name: "Deadlift",
      type: "barbell",
      startWeight: barWeight,
      increment: 5,
      setsReps: { sets: 1, reps: 5 },
      warmupPreset: "bar_pull",
      deloadFloor: 40,
    },
  ];
}

export const defaultProgramDays = {
  A: ["squat", "bench", "row"],
  B: ["squat", "press", "deadlift"],
};

export function seedState() {
  const settings = defaultSettings();
  const exercises = defaultExercises(settings.barWeight);
  const progress = {};
  for (const ex of exercises) {
    progress[ex.id] = { currentWeight: ex.startWeight, consecutiveFailures: 0 };
  }
  return {
    version: SCHEMA_VERSION,
    settings,
    exercises,
    programDays: defaultProgramDays,
    progress,
    history: [],
    nextDay: "A",
  };
}
