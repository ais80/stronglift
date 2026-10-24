# On-device checklist

These checks need the real phone (Galaxy S24+) and watch. The logic tests in
`js/test.html` cover the maths, but they can't cover these. Tick each one off.

**Before you start:** do an **Export JSON** in Settings (or **Backup now** to the T620)
so you can restore your real data afterwards. Some tests below log practice sessions.

## 1. Install and offline

- [ ] Open `https://ais80.github.io/stronglift/` in Chrome → menu → **Install app**.
- [ ] Launch from the home-screen icon. It opens full-screen with no address bar.
- [ ] Turn on airplane mode, then close and reopen the app. It still loads, and your
      data is still there.
- [ ] Still offline: start a workout, log a set, and go back. Nothing breaks.
- [ ] Turn the network back on.

## 2. Rest timer doesn't pause music

Settings: turn on **Notify when rest ends** and allow notifications when asked.
Leave **Beep** off.

- [ ] Start Spotify (or YouTube) playing on the phone.
- [ ] Start a workout and log a set so the rest timer starts.
- [ ] Lock the phone or switch to Spotify, and wait for the timer to hit zero.
- [ ] The phone vibrates **and the music keeps playing at full volume** (no pause, no
      dip).
- [ ] The Galaxy Watch buzzes with the notification.
- [ ] Reopen the app. The timer reads the right time (it didn't freeze while
      backgrounded).
- [ ] *(Optional)* Turn **Beep** on and repeat. You hear a short tone and the music
      still doesn't pause. If it does pause, turn Beep off and note it as a bug.

## 3. Smith machine swap

Note your current **Squat** weight on Home first (say it's 60 kg).

- [ ] Start the workout, then long-press **Squat** → pick **Smith Machine Squat**.
- [ ] A one-time note appears, and the weight is your squat × 1.15 rounded to the
      nearest 2.5 kg (60 kg → 70 kg).
- [ ] Log all sets as hits and finish the workout.
- [ ] History shows the session with *"Also progressed Squat — Next: …"*, and Home shows
      Squat up by 2.5 kg.
- [ ] Next time, swap to Smith Squat again. It starts from its own progressed weight
      (e.g. 72.5 kg), with no one-time note.
- [ ] *(Optional)* Do a normal free-bar Squat session. The Smith Squat weight stays the
      same; it only works in one direction.
- [ ] *(Optional)* Repeat once for Bench (× 1.10) and OHP (× 1.15).

## 4. T620 sync

Tailscale must be connected on the phone.

- [ ] Settings → T620 sync → **Backup now** shows success. If it says "Failed to
      fetch", allow **Local network access** for the site (see `server/README.md`).
- [ ] Finish a workout with auto-sync on. A "Synced to T620" toast appears.
- [ ] Disconnect Tailscale and finish a workout. There's no error, it just doesn't sync.

## 5. Clean up

- [ ] **Restore** from the T620 backup, or **Import** the JSON export, that you made at
      the start. Deleting the practice sessions in History isn't enough, because it
      doesn't undo the weight increases they caused.
- [ ] Check Home shows your real weights again.

## If something fails

Note which step failed, what you saw, and whether Spotify or the watch was involved.
That's enough to start fixing it.
