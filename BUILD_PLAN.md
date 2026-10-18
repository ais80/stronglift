# StrongLift — Build Plan (clean-room 5×5 tracker)

> **Scope & IP note:** This is an **original** workout tracker implementing the public
> 5×5 barbell methodology (Reg Park / Bill Starr lineage). It is **not** a clone of
> StrongLifts. Do **not** copy StrongLifts' code, assets, icons, exact UI layout, or
> copy text. All visual design, naming, and code here are original. REA is used only
> for understanding generic 5×5 program behaviour, never to lift proprietary material.

## 0. Target & stack
- **Platform:** installable **PWA** (Progressive Web App), offline-first, runs from `index.html`.
  Primary device: **Samsung Galaxy S24+ (Android, Chrome)** — must pass Chrome's install
  prompt and launch standalone (no browser chrome) from the home-screen icon.
- **Stack:** vanilla HTML + CSS + ES modules. No build step. `localStorage` for state.
- **Deploy:** **GitHub Pages** (HTTPS, required for PWA install + service worker). Same pattern
  as the user's wedding site. T620 self-hosting is an alternative, not the default.
- **Layout:** mobile-first, works at phone width; dark theme default.
- **Companion:** should be *usable* on a **Galaxy Watch 4 (Wear OS)** via mirrored phone
  notifications only (see §5a) — **no separate Wear app** in v1. The rest-timer alert must
  **not interrupt or pause media** playing on the phone/watch.

## Phase R — REA reference (read-only, do first)
REA is **already set up** in this session (`mcp__rea__*` tools live; `rea-tools/` unpacked).
A prior static investigation already exists — **no new decompilation needed**:
- `../stronglifts-investigation/FINDINGS.md` — section 3 has the generic 5×5 mechanics.
- APK: `../com.stronglifts.app_4.4.1-...apkm` (pairip-protected; parts live in an encrypted
  VM and are not readable — don't chase them).

**What Sonnet may take from FINDINGS.md** (functional facts / standard numbers only):
| Parameter | Value to use |
|---|---|
| Increment (upper: squat/bench/row/OHP) | +2.5 kg (+5 lb) |
| Increment (deadlift) | +5 kg (+10 lb) |
| Failures before deload | 3 consecutive |
| Deload amount | −10%, rounded **down** to the increment step |
| Deload floors (kg) | squat/bench/OHP 20, row 30, deadlift 40 |
| Success definition | every set's reps ≥ target (top-set lifts: last set only) |
| Default rest | 180 s on success, 300 s on fail |
| Default bar | 20 kg / 45 lb |
| Warmup ramp (barbell) | empty bar ×2, then +20 kg steps to (work−10); reps 5,5,…,3,2,1 |
| Plate calc | (target−bar)/2 per side, greedy largest-first, exact only |

**Do NOT port (proprietary/bespoke expression — use standard open methods instead):**
- Their RPE-lookup e1RM → use **Epley** (`w*(1+reps/30)`) in `calc.js`.
- Their BMI-based "elite lift / new-lifter threshold" onboarding generator → use a simple
  user-entered starting weight.
- Their exact "deload-after-break" keep-% curve and Madcow back-off scheme → v1 uses only the
  plain 3-fail deload above; time-off handling is a phase-2 note.
- Any UI layout, icons, colours, strings, or decompiled code. Names/screens are original.

This phase is **reference reading only** — it produces no code and copies no source.

## 1. File structure
```
StrongLift/
  index.html            # app shell + nav
  css/styles.css        # tokens, layout, components
  js/app.js             # bootstrap, routing between views
  js/state.js           # load/save, schema + migrations (localStorage)
  js/program.js         # 5x5 program definition + progression engine
  js/calc.js            # plate math + warmup set math
  js/timer.js           # rest timer (+ optional notification/beep)
  js/views/             # one module per screen (render + events)
    home.js  workout.js  history.js  progress.js  settings.js  exercises.js
  data/seed.js          # default program, exercises, default settings
  manifest.webmanifest  # PWA metadata: name, icons, standalone, theme colour
  service-worker.js     # offline cache (app shell + assets)
  icons/                # original app icons: 192, 512, maskable 512, apple-touch 180
  README.md             # how to run, install on phone, deploy to Pages, feature list
```

## 2. Data model (localStorage key `stronglift.v1`)
- `settings`: `{ units:'kg'|'lb', barWeight, plates:[...], incrementUpper, incrementLower,
  deloadPct, failuresBeforeDeload, restSecsMain, restSecsLast, theme }`
- `exercises`: `[{ id, name, type:'barbell'|'bodyweight', startWeight, increment,
  setsReps:{sets,reps}, warmupPreset }]`
- `programDays`: `A` = [Squat, Bench, Barbell Row]; `B` = [Squat, Overhead Press, Deadlift].
  Squat 5×5, Bench/Row/Press 5×5, Deadlift 1×5.
- `progress`: per-exercise `{ currentWeight, consecutiveFailures }`
- `history`: `[{ id, date, day:'A'|'B', entries:[{exerciseId, targetWeight,
  sets:[{reps, done}], success }], durationSecs }]`
- `nextDay`: `'A'|'B'` (alternates on completion)

Write `state.js` with `load()`, `save()`, `migrate(oldVersion)` so the schema can evolve.

## 3. Progression engine (`program.js`)
Pure functions, unit-testable, no DOM:
- `nextWeight(exercise, progress, succeeded)`:
  - success → `+increment` (upper-body default +2.5 kg / lower & deadlift +5 kg; lb variant +5/+10).
  - failure → increment `consecutiveFailures`; if it hits `failuresBeforeDeload` (default 3),
    apply deload `weight * (1 - deloadPct)` (default 10%), round to nearest plate step, reset counter.
- `isSuccess(entry)` = every set hit its target reps.
- `buildWorkout(day)` = assemble today's exercises at their current weights.
- Keep all rounding in one `roundToStep(weight, step)` helper.

## 4. Calculators (`calc.js`)
- `platesFor(targetWeight, barWeight, availablePlates)` → list of plates **per side** using
  greedy largest-first; flag when the target isn't reachable and show the closest.
- `warmupSets(targetWeight, barWeight)` → standard ramp (empty bar ×5, ~40% ×5, ~60% ×3,
  ~80% ×2) rounded to plate steps; skip warmups below a threshold.

## 5. Rest timer (`timer.js`) — media-safe
- Count-up during a set, count-down rest between sets.
- Configurable: main-set rest vs after a failed/last set.
- Auto-start on tapping a set as done; visible countdown. Must survive tab backgrounding
  (store `endTime`, recompute on focus/`visibilitychange`).
- **Must not pause/duck phone or watch media.** Alert order of preference:
  1. **`navigator.vibrate()`** — primary alert; never touches audio.
  2. **Notification** at zero (see §5a) — fires even when backgrounded, mirrors to the watch.
  3. Optional beep that defaults **OFF**. If on, use a short **WebAudio** tone only —
     **do NOT** use the **Media Session API** or an `<audio>`/`MediaElement` that requests
     audio focus, as that is what pauses Spotify/YouTube. Keep WebAudio context on the default
     (non-communication) routing so Android treats it as a UI sound, not a media stream.

## 5a. Watch support via notifications (no Wear app)
- When rest hits zero (and on workout milestones), fire a web **Notification** through the
  service worker's registration. On the S24+ this mirrors to the **Galaxy Watch 4** and
  vibrates it — the realistic "works on the watch" path without a native build.
- Request notification permission lazily (first time the user enables timer alerts), never on
  load. Degrade gracefully if denied (vibration + on-screen only).
- Keep notifications silent/low-priority so they buzz but don't play a sound over media.
- A true standalone Wear OS tile/app is **out of scope** — note it in README phase 2.

## 6. Views (each = `render(container, state)` + wired events)
1. **Home** — next workout (A/B), each lift's target weight, "Start workout" button;
   quick deload/next-weight preview.
2. **Workout** — the live screen: per exercise, 5 (or 1) tappable set cells that cycle
   reps → mark done; plate breakdown under each lift; warmup toggle; rest timer bar;
   "Finish" computes success per lift, updates progress, appends to history, flips `nextDay`.
3. **History** — reverse-chronological list; tap a session for detail; delete a session.
4. **Progress** — per-exercise weight-over-time line chart (inline SVG, no library) +
   estimated 1RM (Epley) line; best set table.
5. **Exercises** — edit names, start weights, increments, sets×reps; add a custom lift.
6. **Settings** — units (kg/lb with conversion), bar weight, available plates, increments,
   deload %, failures-before-deload, rest durations, theme, **export/import JSON**, reset.

## 7. Design tokens (`styles.css`)
- Define CSS custom properties on `:root`; dark default with a light override via
  `prefers-color-scheme` + a manual `data-theme` toggle. One accent colour, generous tap
  targets (≥44px), bottom tab bar on mobile. Original palette — not StrongLifts' colours.

## 8. Build order for Sonnet (incremental, each step runnable)
1. `index.html` shell + `styles.css` tokens + bottom-nav routing in `app.js`.
2. `seed.js` + `state.js` (load/save/migrate) — verify persistence in console.
3. `program.js` + `calc.js` as pure modules — add a tiny `js/test.html` that runs
   assertions in-page (progression, deload, plate math) and prints pass/fail.
4. **Workout** view end-to-end (the core loop) wired to state + program engine.
5. **Home**, then **History**.
6. **Progress** charts (inline SVG).
7. **Exercises** + **Settings** (incl. JSON export/import, kg↔lb).
8. `timer.js` integrated into Workout (media-safe, §5/§5a); polish, empty states,
   confirm-before-delete.
9. **PWA layer:** `manifest.webmanifest`, original `icons/`, `service-worker.js`
   (cache-first app shell, network-fallback), register SW from `app.js`. Verify Chrome
   DevTools → Application shows it installable with no manifest/SW errors.
10. **Deploy to GitHub Pages:** push `StrongLift/` to a repo, enable Pages. Because Pages
    serves from a subpath (`/<repo>/`), make every asset path and the SW `scope`/cache list
    **relative** (no leading `/`), or set a `<base>` — test this explicitly, it's the usual
    Pages PWA gotcha.
11. `README.md`: run locally, **install on the S24+** (open Pages URL in Chrome → menu →
    Add to Home screen / Install app), deploy/update steps, feature list, phase-2 notes
    (standalone Wear OS app, cloud sync).

## 9. Acceptance checks
- Complete a Workout A → weights increase correctly, history records it, next day flips to B.
- Fail a lift 3× → deload applies at the right amount and resets the counter.
- Plate calculator matches hand math for a few weights in kg and lb.
- Reload page → all state restored. Export then import → identical state.
- Timer keeps correct time after backgrounding the tab.
- Usable one-handed at phone width; passes a basic contrast check.
- **PWA:** installs on the S24+ from Chrome, launches standalone, works with the network off.
- **Media-safe:** with Spotify/YouTube playing, a rest-timer alert at zero vibrates (and
  notifies the watch) **without pausing or ducking** the audio.
- **Pages:** loads correctly from the `/<repo>/` subpath; SW registers (relative scope).

## 10. Out of scope for v1 (note, don't build)
Cloud sync, accounts, multiple programs (5/3/1 etc.), Apple Watch, social — list in README
as possible phase 2.

## 11. Phase 2 — set scheme, alternates, accessories, cues

Agreed with the user (see conversation); no engine changes needed — `isSuccess`/
`nextWeight`/`applyWorkoutResult` already work on whatever sets/exercise-id a session
logs, so this is schema + UI.

### Data model additions
- `settings.defaultSetScheme: '5x5' | '3x5'` (default `'5x5'`).
- Per exercise: `alternates: [exerciseId, ...]`, `cue: string` (one-line setup/execution
  tip), `repUnit: 'reps' | 'seconds'` (default `'reps'`; Plank uses `'seconds'` so its
  target displays as "45 sec" not "45 reps" — same engine, just a label).
- New seeded exercises (all fully tracked like any other lift; `type: 'bodyweight'` so
  they skip the barbell plate calculator/warmup ramp — machines, dumbbells, cables, and
  bodyweight moves don't use barbell plates):
  - Alternates (14): Leg Press, Goblet Squat, Hack Squat / DB Bench Press, Push-ups,
    Machine Chest Press / Cable Row, DB Row, Chest-Supported Row / DB Shoulder Press,
    Machine Shoulder Press / Trap Bar Deadlift, Romanian Deadlift, Rack Pull.
  - Accessories (5): Plank (`repUnit: 'seconds'`), Face Pulls, Bicep Curls, Tricep
    Pushdown, Hanging Leg Raise.
  - `deloadFloor` defaults to each one's own `startWeight` (conservative: light/machine
    work won't auto-deload below where it started).
- Main lifts (`squat`, `bench`, `row`, `press`, `deadlift`) get their `alternates` list
  populated per the mapping above.

### Set scheme (3×5 / 5×5)
- Toggle shown on **Home** and **Workout** (both edit the same `settings.
  defaultSetScheme`). On Workout it **locks once any set in that session is logged**.
- Effective sets for a "main slot" entry (squat/bench/row/press, or whatever's
  currently swapped into that slot) = `scheme === '3x5' ? min(originalSets, 3) :
  originalSets`. Deadlift (1 set) and any accessory add-on are unaffected regardless
  of scheme.
- Draft entries get an `isMainSlot: boolean` (set at `buildDraft`, preserved through a
  swap) so the scheme reduction applies to whichever exercise currently fills that
  slot, and never to accessory add-ons.

### Alternates (long-press swap)
- Long-press (~500ms hold, short `navigator.vibrate` on trigger; cancels on
  pointerup/move) on a lift **in the Workout screen only** opens a picker: that lift's
  curated `alternates` + "choose another lift" (full exercise list fallback).
- Swapping replaces that draft entry's exercise (id/name/type/weight/setsReps/
  increment/warmupPreset/cue) for **this session only** — `programDays` is untouched,
  and the original lift's `progress` entry is simply not updated this session. The
  alternate's own `progress`/history is used and updated normally through the existing
  engine (no special-casing).
- Locks once a set's logged for that slot (no re-swap mid-stream, same rule as below).

### Accessory block
- Collapsible "Optional — if you have time" section after the main lifts, before
  Finish: quick-add chips for the 5 curated accessories + a "+ more…" fallback (same
  picker component as alternates, in "add" mode instead of "swap" mode).
- Tapping a chip appends a normal, fully-interactive exercise block to the draft
  (`isMainSlot: false`) — identical set-cell UI/logging to a main lift. Removable via a
  small "×" **only while no set in it has been logged yet**; once logged, it's locked
  in and finishes/progresses like any other lift.
- Not pre-assigned to `programDays.A`/`B` — adding one only affects today's session.

### Form cues
- Every exercise (main + alternates + accessories) carries a one-line `cue`. Shown via
  a collapsed-by-default "ⓘ Tips" toggle under the exercise name in Workout.
