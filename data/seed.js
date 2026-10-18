// seed.js — default program, exercises, and settings for a first run.
// Numbers here are the generic, standard 5x5 parameters (see BUILD_PLAN.md "Phase R"
// table) — not anything copied from a specific app's source or assets.

export const SCHEMA_VERSION = 2;

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
    defaultSetScheme: "5x5", // '5x5' | '3x5' — shown/editable from Home and Workout
    syncServerUrl: "", // e.g. https://t620.<tailnet>.ts.net:8443 — see server/README.md
    syncApiKey: "",
    autoSyncAfterWorkout: true, // best-effort, silent background PUT after Finish (never blocks/errors visibly)
  };
}

// warmupPreset: 'bar_main' (squat/bench/press — starts from two empty-bar sets)
//              'bar_pull' (row/deadlift — no empty-bar sets)
// type: 'barbell' uses the plate calculator + warm-up ramp; 'bodyweight' is the
//       catch-all for machines/dumbbells/cables/bodyweight moves, which skip both —
//       the plate math only makes sense for a loaded barbell.
// repUnit: 'reps' (default) or 'seconds' (for holds like Plank — same engine, just a label).
// deloadFloor: for the 5 main lifts this is the standard generic floor from BUILD_PLAN's
//       Phase R table; every other (alternate/accessory) exercise defaults it to its own
//       startWeight — conservative, so light/machine work won't auto-deload below where
//       it started. Editable per-exercise in Lifts either way.

export function defaultExercises(barWeight = 20) {
  const mains = [
    {
      id: "squat",
      name: "Squat",
      type: "barbell",
      startWeight: barWeight,
      increment: 2.5,
      setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main",
      deloadFloor: 20,
      repUnit: "reps",
      cue: "Bar on your upper back, feet shoulder-width. Brace your core, break at the hips and knees together, keep your chest up and knees tracking over your toes.",
      alternates: ["leg_press", "goblet_squat", "hack_squat"],
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
      repUnit: "reps",
      cue: "Grip just wider than shoulders, shoulder blades pulled together and down. Lower to your chest with control, drive through your feet, press back up.",
      alternates: ["db_bench", "pushups", "machine_chest_press"],
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
      repUnit: "reps",
      cue: "Hinge at the hips to about 45°, flat back. Pull the bar to your lower ribs, squeeze your shoulder blades, lower under control.",
      alternates: ["cable_row", "db_row", "chest_supported_row"],
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
      repUnit: "reps",
      cue: "Bar at collarbone height, grip just outside shoulders. Brace your core, press straight up, tuck your head through at the top.",
      alternates: ["db_shoulder_press", "machine_shoulder_press"],
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
      repUnit: "reps",
      cue: "Bar over mid-foot, flat back, chest up. Push the floor away with your legs, keep the bar close, lock out hips and knees together.",
      alternates: ["trap_bar_deadlift", "romanian_deadlift", "rack_pull"],
    },
  ];

  // Alternates — stand in for a main lift's program slot for a single session (see
  // BUILD_PLAN.md §11). setsReps mirrors the lift they substitute for, so the day's
  // 3x5/5x5 scheme toggle still applies sensibly once swapped in.
  const alternates = [
    {
      id: "leg_press", name: "Leg Press", type: "bodyweight",
      startWeight: 40, increment: 10, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Feet shoulder-width on the platform. Lower until your knees reach about 90°, press through your heels without locking out hard.",
    },
    {
      id: "goblet_squat", name: "Goblet Squat", type: "bodyweight",
      startWeight: 10, increment: 2.5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Hold a dumbbell at your chest. Squat down keeping your torso upright and elbows inside your knees, drive back up.",
    },
    {
      id: "hack_squat", name: "Hack Squat", type: "bodyweight",
      startWeight: 20, increment: 10, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Shoulders and back flat against the pad. Lower under control to parallel, drive through your whole foot.",
    },
    {
      id: "db_bench", name: "DB Bench Press", type: "bodyweight",
      startWeight: 10, increment: 2.5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Dumbbells at chest level, elbows at about 45°. Press up and slightly in, lower with control.",
    },
    {
      id: "pushups", name: "Push-ups", type: "bodyweight",
      startWeight: 0, increment: 2.5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Hands just outside shoulder width, body in a straight line. Lower your chest to the floor, press back up without flaring elbows wide.",
    },
    {
      id: "machine_chest_press", name: "Machine Chest Press", type: "bodyweight",
      startWeight: 15, increment: 5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Set the seat so the handles sit at chest height. Press forward without locking elbows hard, control the return.",
    },
    {
      id: "cable_row", name: "Cable Row", type: "bodyweight",
      startWeight: 15, increment: 5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "Sit tall, slight hip hinge. Pull the handle to your abdomen, squeeze your shoulder blades, extend with control.",
    },
    {
      id: "db_row", name: "DB Row", type: "bodyweight",
      startWeight: 12.5, increment: 2.5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "One knee and hand on a bench, flat back. Pull the dumbbell to your hip, squeeze at the top, lower fully.",
    },
    {
      id: "chest_supported_row", name: "Chest-Supported Row", type: "bodyweight",
      startWeight: 15, increment: 5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "Chest against the pad, arms hanging. Pull the handles to your ribs, squeeze your shoulder blades, control the lowering.",
    },
    {
      id: "db_shoulder_press", name: "DB Shoulder Press", type: "bodyweight",
      startWeight: 7.5, increment: 2.5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Dumbbells at shoulder height, palms forward. Press straight overhead without flaring your lower back, lower with control.",
    },
    {
      id: "machine_shoulder_press", name: "Machine Shoulder Press", type: "bodyweight",
      startWeight: 15, increment: 5, setsReps: { sets: 5, reps: 5 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Set the seat so handles start at shoulder height. Press up without locking out hard, control the descent.",
    },
    {
      id: "trap_bar_deadlift", name: "Trap Bar Deadlift", type: "barbell",
      startWeight: barWeight, increment: 5, setsReps: { sets: 1, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "Stand centered in the bar, flat back, chest up. Push the floor away through your legs, stand tall, lower under control.",
    },
    {
      id: "romanian_deadlift", name: "Romanian Deadlift", type: "barbell",
      startWeight: barWeight, increment: 5, setsReps: { sets: 1, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "Soft knees, push your hips back keeping the bar close to your legs. Lower until you feel a hamstring stretch, drive hips forward to stand.",
    },
    {
      id: "rack_pull", name: "Rack Pull", type: "barbell",
      startWeight: barWeight, increment: 5, setsReps: { sets: 1, reps: 5 },
      warmupPreset: "bar_pull", repUnit: "reps", alternates: [],
      cue: "Set pins just below knee height. Flat back, brace, drive through your legs and hips to lock out.",
    },
  ];

  // Accessories — never pre-assigned to a program day; added to a session on demand
  // from the "Optional — if you have time" block, fully tracked like any other lift.
  const accessories = [
    {
      id: "plank", name: "Plank", type: "bodyweight",
      startWeight: 0, increment: 2.5, setsReps: { sets: 3, reps: 45 },
      warmupPreset: "bar_main", repUnit: "seconds", alternates: [],
      cue: "Forearms and toes on the floor, body in a straight line from head to heels. Brace your core and glutes, breathe steadily.",
    },
    {
      id: "face_pulls", name: "Face Pulls", type: "bodyweight",
      startWeight: 10, increment: 2.5, setsReps: { sets: 3, reps: 15 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Rope at upper-chest height. Pull towards your face, elbows high, squeeze your shoulder blades together at the end.",
    },
    {
      id: "bicep_curls", name: "Bicep Curls", type: "bodyweight",
      startWeight: 10, increment: 2.5, setsReps: { sets: 3, reps: 10 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Elbows pinned to your sides. Curl the weight up without swinging, lower under control.",
    },
    {
      id: "tricep_pushdown", name: "Tricep Pushdown", type: "bodyweight",
      startWeight: 15, increment: 2.5, setsReps: { sets: 3, reps: 12 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Elbows pinned to your sides. Push the bar or rope down to full extension, control the return, don't let your elbows flare.",
    },
    {
      id: "hanging_leg_raise", name: "Hanging Leg Raise", type: "bodyweight",
      startWeight: 0, increment: 2.5, setsReps: { sets: 3, reps: 10 },
      warmupPreset: "bar_main", repUnit: "reps", alternates: [],
      cue: "Hang from the bar with a slight lean back. Raise your legs (or knees) up with control, avoid swinging, lower slowly.",
    },
  ];

  const all = [...mains, ...alternates, ...accessories];
  for (const ex of all) {
    if (ex.deloadFloor === undefined) ex.deloadFloor = ex.startWeight;
  }
  return all;
}

// Ids that are never pre-assigned to a program day — only added to a session from the
// accessory block's quick-add chips. Everything else is a main lift or an alternate.
export const ACCESSORY_IDS = [
  "plank",
  "face_pulls",
  "bicep_curls",
  "tricep_pushdown",
  "hanging_leg_raise",
];

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
