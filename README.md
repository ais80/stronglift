# StrongLift

A simple, original 5×5 barbell workout tracker. Installable as a PWA, works offline,
no account, no server — your data lives in your browser (`localStorage`).

> **About this build.** This is a clean-room implementation of the public 5×5 barbell
> method (Reg Park / Bill Starr lineage) — not a clone of any specific commercial app.
> See `BUILD_PLAN.md` for the full spec and the scope/IP notes behind the design choices.

## Features

- **5×5 program**: alternating Day A (Squat, Bench Press, Barbell Row) / Day B (Squat,
  Overhead Press, Deadlift), all editable.
- **3×5 / 5×5 toggle**: short on time? Switch to 3 sets for Squat/Bench/Row/Press from
  Home or Workout (Deadlift stays 1×5 either way). Locks once a set's logged that session.
- **Swap a lift mid-workout**: long-press any main lift during a workout to substitute
  an alternative (rack/bench busy?) — curated suggestions per lift plus your full list.
  The substitute gets its own independent weight/history; your original lift's
  progression just sits out that session, untouched.
- **Optional accessory work**: an "if you have time" block at the end of a workout —
  quick-add Plank, Face Pulls, Bicep Curls, Tricep Pushdown, Hanging Leg Raise (or
  anything else), fully tracked just like a main lift.
- **Form cues**: a collapsed-by-default "Tips" note on every lift with a one-line
  setup/execution cue.
- **Auto progression**: +2.5 kg (upper body) / +5 kg (deadlift) per successful session;
  3 consecutive misses triggers a 10% deload, floored so it never drops below a sane
  working weight.
- **Plate calculator**: per-side plate breakdown from the plates you actually own.
- **Warm-up sets**: an automatic percentage-based ramp before your work sets.
- **Rest timer**: counts down after each set, survives the tab being backgrounded.
  **Media-safe** — the alert is vibration + a silent notification, never audio, so it
  never pauses Spotify/YouTube.
- **Watch support (no separate app)**: enable notifications in Settings and, on a
  Galaxy S24+ with a paired Galaxy Watch 4, the rest-timer alert mirrors to the watch.
- **History**: every session logged, with delete (confirmed) and detail view.
- **Progress**: a weight-over-time chart per lift plus an Epley-estimated 1RM line and
  your best set.
- **Exercises**: edit weight/increment/sets×reps/cue/alternates per lift, or add your own.
- **Settings**: kg ⇄ lb (converts everything), bar weight, plate inventory, deload
  rules, rest durations, theme (dark/light/auto), and full JSON export/import.
- **Installable PWA**: add to your phone's home screen, launches full-screen, works
  with no network connection.

## Run it locally

ES modules and the service worker both require `http(s)://`, not `file://`. From the
project root:

```bash
python -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080/`.

### Run the self-tests

`js/test.html` runs the progression/plate-math logic in-page and prints pass/fail —
open `http://localhost:8080/js/test.html` with the server above running.

## Install on your phone (Galaxy S24+)

1. Open the deployed URL (see **Deploy** below) in Chrome on the phone.
2. Chrome's menu → **Add to Home screen** / **Install app** (Chrome may also prompt
   automatically after a visit or two).
3. Launch it from the home screen icon — it opens full-screen, no browser bar.
4. It keeps working with no signal; it syncs nothing, so it only knows about workouts
   logged on that device (use **Export JSON** in Settings to back up / move data).

### Galaxy Watch 4

There's no separate watch app. In Settings, turn on **"Notify when rest ends"** — on
Android this mirrors to a paired Wear OS watch, so the watch buzzes when your rest
timer ends. It's vibration-only by design, so it never interrupts music or video
playing on your phone or watch.

## Deploy to GitHub Pages

1. Push this folder's contents to a GitHub repo (root of the repo, or a `/docs` folder
   — just make sure Pages serves this directory).
2. Repo **Settings → Pages** → set the source branch/folder → save.
3. Your app is live at `https://<username>.github.io/<repo>/`.

**Pages serves from a subpath**, so every path in this app is deliberately relative
(`css/styles.css`, not `/css/styles.css`) and the service worker's scope and cache list
are relative too. If you fork/rename the repo, no path changes are needed.

### Updating after a deploy

Push new commits to the same branch; Pages rebuilds automatically (usually under a
minute). The service worker checks the network first for page navigations, so a
reload picks up the new version; fully offline, it falls back to the last cached copy.

## Project structure

See `BUILD_PLAN.md` for the full spec. Short version:

- `js/program.js` / `js/calc.js` — the progression engine and plate/warm-up math (pure
  functions, no DOM; covered by `js/test.html`).
- `js/state.js` + `data/seed.js` — persistence (`localStorage`) and defaults.
- `js/views/*.js` — one module per screen.
- `js/timer.js` — the media-safe rest timer.
- `manifest.webmanifest` + `service-worker.js` + `icons/` — the PWA layer.

## Phase 2 (not built, noted for later)

- A real standalone Wear OS tile/app (today's watch support is notification-mirroring
  only).
- Cloud sync / accounts / multi-device.
- Alternate programs (5/3/1, Madcow, etc.) alongside 5×5.
- A "deload after a break" prompt for returning after time off.
- Social/sharing features.
