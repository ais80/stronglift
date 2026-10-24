# StrongLift

A simple, original 5×5 barbell workout tracker. Installable as a PWA, works offline,
no account — your data lives in your browser (`localStorage`), with optional backup to
your own server (see **T620 sync** below).

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
  progression just sits out that session, untouched — *unless* it's a Smith machine
  equivalent (below), which is the deliberate exception.
- **Smith machine equivalents**: Squat/Bench/Overhead Press each have a Smith machine
  alternate. The *first* time you swap to one, its starting weight is auto-scaled up
  from today's free-bar weight (+15% squat/press, +10% bench — rough rule-of-thumb
  starting points, tune the multiplier in Lifts) to account for the machine's fixed bar
  path doing the stabilizing work for you. After that it progresses on its own weight
  scale — but every Smith session *also* feeds its hit/miss straight into the real
  lift's own progression (its own weight/increment/deload, not derived from the Smith
  number), since the whole point of load-matching them is that a successful Smith
  session counts as equivalent effort. One-directional: a normal free-bar session
  doesn't feed back into the Smith side.
- **Optional accessory work**: an "if you have time" block at the end of a workout —
  quick-add Plank, Face Pulls, Bicep Curls, Tricep Pushdown, Hanging Leg Raise (or
  anything else), fully tracked just like a main lift.
- **Form cues**: a collapsed-by-default "Tips" note on every lift with a one-line
  setup/execution cue.
- **Auto progression**: +2.5 kg (upper body) / +5 kg (deadlift) per successful session;
  3 consecutive misses triggers a 10% deload, floored so it never drops below a sane
  working weight.
- **Plate calculator**: per-side plate breakdown from the plates you actually own.
- **Warm-up sets**: an automatic percentage-based ramp before your work sets. Each
  warm-up shows its plates per side and can be ticked off. Ticked warm-ups are saved to
  History but never affect progression.
- **Rest timer**: counts down after each set, and survives the app being backgrounded
  or closed.
- **Lock-screen workout notification**: shows the next set (warm-up or work set, with
  plates), "Resting · next set at 14:35" during rest, and a **✓ Done** button that logs
  the set without unlocking. The rest-over alert comes from the service worker, so it
  still fires while the app is asleep (for rests up to ~4¾ min). A missed set is
  corrected in the app.
- **Media-safe**: alerts are vibration and notifications only, never audio, so YT
  Music/Spotify keep playing. Set StrongLift's notification sound to Silent on the phone
  so Android doesn't dip the music either (see `TESTING.md` §2).
- **Watch support (no separate app)**: the rest-over notification mirrors to a paired
  Galaxy Watch and buzzes it.
- **History**: every session logged, with delete (confirmed) and detail view.
- **Progress**: a weight-over-time chart per lift plus an Epley-estimated 1RM line and
  your best set.
- **Exercises**: edit weight/increment/sets×reps/cue/alternates per lift, or add your own.
- **Settings**: kg ⇄ lb (converts everything), bar weight, plate inventory, deload
  rules, rest durations, theme (dark/light/auto), and full JSON export/import.
- **Installable PWA**: add to your phone's home screen, launches full-screen, works
  with no network connection.
- **T620 sync (optional)**: back up / restore your data to a tiny self-hosted server on
  your tailnet, and auto-backup after each workout. If the T620 isn't reachable, the
  backup waits and retries until it lands. A MacroDroid macro can connect Tailscale on
  home Wi-Fi, back up, and disconnect again; no API key is needed with Tailscale
  sign-in. Setup in `server/README.md`.

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

### On-device checks

`TESTING.md` is a checklist for the things only the real phone can prove (media-safe
timer, install/offline, Smith machine swaps, T620 sync).

## Install on your phone (Galaxy S24+)

1. Open the deployed URL (see **Deploy** below) in Chrome on the phone.
2. Chrome's menu → **Add to Home screen** / **Install app** (Chrome may also prompt
   automatically after a visit or two).
3. Launch it from the home screen icon — it opens full-screen, no browser bar.
4. It keeps working with no signal. Data lives on that device; back it up with
   **Settings → T620 sync** (needs Tailscale on the phone) or **Export JSON**.

### Galaxy Watch 4

There's no separate watch app. In Settings, turn on **"Lock-screen workout
notification"**. On Android the rest-over alert mirrors to a paired Wear OS watch, so
the watch buzzes when your rest ends. For the Samsung settings that keep it working
with the phone locked (silent sound, never-sleeping app), see `TESTING.md` §2.

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
- Writing workouts to Samsung Health / Health Connect (a web app can't; it needs a
  native Android wrapper).
- Live multi-device sync / accounts (today's T620 sync is a single-device backup and
  restore, not a two-way merge).
- Alternate programs (5/3/1, Madcow, etc.) alongside 5×5.
- A "deload after a break" prompt for returning after time off.
- Social/sharing features.
