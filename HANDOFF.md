# Handoff — for the executing model (Sonnet)

**Workspace:** `C:\Users\asifs\Downloads\StrongLift\`
**Spec to follow:** `BUILD_PLAN.md` (in this folder). Build it in the order of §8.

## First prompt to give Sonnet (paste this)

> Build the app described in `C:\Users\asifs\Downloads\StrongLift\BUILD_PLAN.md`. Follow the
> file structure (§1), data model (§2), and the step-by-step build order (§8); satisfy the
> acceptance checks (§9) before calling it done. This is an **original, clean-room** 5×5
> workout tracker — write your own code, design, icons, and copy. Do **not** copy any code,
> assets, UI layout, colours, or strings from StrongLifts. Phase R (§Phase R) is
> **read-only reference**: you may use the plain functional numbers already recorded in
> `..\stronglifts-investigation\FINDINGS.md` (increments, deload math, warmup ladders, rest
> defaults, plate-calc approach), but honour the "Do NOT port" list — use Epley for e1RM,
> plain user-entered start weights, and the simple 3-fail deload only. Target is an
> installable PWA for a Galaxy S24+ deployed to GitHub Pages; the rest timer must be
> media-safe (§5/§5a) — vibrate + silent notification, never grab audio focus. Keep each
> §8 step independently runnable.

## Non-negotiable boundaries
- **Clean-room.** The APK is pairip-protected and parts are unreadable anyway — do not try to
  unpack the encrypted VM. Nothing proprietary (code/assets/icons/layout/text) goes in.
- **Reference only** from `FINDINGS.md`: generic functional parameters, not expression.
- **Do NOT port** (see BUILD_PLAN §Phase R): their RPE-table e1RM, BMI-based onboarding
  estimator, deload-after-break curve, Madcow back-off scheme. Use the standard methods named.

## Key inputs on disk
- `BUILD_PLAN.md` — the full spec (this is the source of truth).
- `..\stronglifts-investigation\FINDINGS.md` §3 — the functional numbers to reference.

## Definition of done
All §9 acceptance checks pass, including: installs + runs offline on the S24+; a rest-timer
alert at zero does **not** pause Spotify/YouTube; loads correctly from the GitHub Pages
`/<repo>/` subpath (relative paths / SW scope). README documents run, install, and deploy.

## Environment notes
- Windows 11, PowerShell primary. No build step / node_modules — plain static files.
- Git commit trailer for this repo:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  (the executing model should use its own identity in the trailer if different).
- Commit/push only when the user asks; if not in a git repo yet, `git init` first and branch
  off the default branch.
