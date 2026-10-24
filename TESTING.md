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
- [ ] Still offline: start a workout, tick a warm-up and a set, and go back. Nothing
      breaks.
- [ ] Each warm-up row shows its weight, reps and plates per side (e.g. "35 kg × 5 ·
      5×1 + 2.5×1 /side"). Tap one, and it gets a ✓. After you finish, History shows
      the warm-ups you ticked.
- [ ] Turn the network back on.

## 2. One-time Samsung setup (S24+)

Do these once after installing. Exact menu names can vary a little between One UI
versions.

- [ ] **Turn the notification on:** in StrongLift, Settings → turn on **Lock-screen
      workout notification** and allow notifications when asked.
- [ ] **No sound, keep vibration** (so YT Music never dips): phone **Settings →
      Notifications → App notifications → StrongLift**, then open its notification
      category and set **Sound** to **Silent** (or None) with **Vibrate** on.
- [ ] **Show it on the lock screen:** **Settings → Lock screen → Notifications**: on,
      showing details (not "icons only").
- [ ] **Don't let Samsung put it to sleep:** **Settings → Battery → Background usage
      limits → Never sleeping apps** → add **StrongLift** and **Chrome**. Without this,
      the rest-over alert can arrive late or not at all while the phone is locked.
- [ ] **Watch:** Galaxy Wearable app → Watch settings → Notifications → make sure
      StrongLift is allowed.

## 3. Lock screen and YT Music

- [ ] Start YT Music playing. Open a workout. A notification appears: "Up next" with
      the first warm-up, its plates, and a **✓ Done** button.
- [ ] Lock the phone. Press **✓ Done** on the lock screen. The notification moves to the
      next warm-up. (If Samsung asks you to unlock first, note it. That's a phone
      setting, not the app.)
- [ ] Work through the warm-ups to the first work set, then press **✓ Done**. It shows
      **"Resting · next set at HH:MM"**.
- [ ] When the rest ends, the phone **vibrates** and the watch buzzes with "Rest over".
      **YT Music keeps playing at full volume.** If the music dips, re-check the
      Silent sound setting in step 2.
- [ ] Do a few sets from the lock screen, then unlock and open StrongLift. The sets you
      logged are ticked, a "Logged N sets from the notification" message shows, and the
      rest timer is still counting.
- [ ] Missed reps: tap the notification to open the app, then tap that set to correct
      the reps. (The lock-screen button always logs a full set.)
- [ ] *(Optional)* Turn **Beep** on and repeat. If YT Music dips, leave Beep off.

## 4. Smith machine swap

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

## 5. T620 sync

Tailscale must be connected on the phone.

- [ ] Settings → T620 sync → **Backup now** shows success. If it says "Failed to
      fetch", allow **Local network access** for the site (see `server/README.md`).
- [ ] Finish a workout with auto-sync on. A "Synced to T620" toast appears.
- [ ] Disconnect Tailscale and finish a workout. It says *"Saved. It'll back up to the
      T620 once it's reachable."* Settings → T620 sync shows that a backup is waiting.
- [ ] Reconnect Tailscale and reopen StrongLift. Within a few seconds: "Backed up to
      T620." (It also retries by itself on a network change and every minute while the
      app is open, and Chrome retries in the background a few times.)

**Back up automatically when you get home (MacroDroid).** On home Wi-Fi: connect
Tailscale, open StrongLift's backup link, wait, then disconnect Tailscale. A web app
can't see the Wi-Fi network or switch a VPN, and Samsung Routines can't switch
Tailscale either, so this uses **MacroDroid** (free on the Play Store; Tasker works the
same way).

One-time checks:
- [ ] Tailscale has been connected by hand at least once, so Android already allows it
      as a VPN.
- [ ] Tailscale is **not** set as Always-on VPN (Settings → Connections → More
      connection settings → VPN → Tailscale ⚙). If it is, the disconnect step can't
      work.
- [ ] In StrongLift: Settings → T620 sync → **API key blank**. The server accepts your
      Tailscale sign-in instead.

Make the macro: **MacroDroid → Add Macro**.
- [ ] **Trigger:** *Wi-Fi State Change* → *Connected to network* → your home Wi-Fi.
- [ ] **Action 1, connect Tailscale:** *Send Intent* → Target **Broadcast**,
      Action `com.tailscale.ipn.CONNECT_VPN`, Package `com.tailscale.ipn`,
      Class `com.tailscale.ipn.IPNReceiver`.
- [ ] **Action 2:** *Wait Before Next Action* → 5 seconds.
- [ ] **Action 3, back up:** *Open Website* →
      `https://ais80.github.io/stronglift/index.html#/backup`. It should open in the
      installed StrongLift app. If it opens a Chrome tab instead, use *Launch Shortcut*
      → StrongLift → **Back up to T620**. The app keeps retrying for about 40 seconds
      while Tailscale connects.
- [ ] **Action 4:** *Wait Before Next Action* → 45 seconds.
- [ ] **Action 5, disconnect Tailscale:** *Send Intent*, same as Action 1 but with
      Action `com.tailscale.ipn.DISCONNECT_VPN`.
- [ ] **Action 6 (optional):** *Launch Home Screen*.
- [ ] If the phone is usually locked when you walk in, add a first action *Wait Until
      Trigger* → *Screen Unlocked*. Chrome may not run the backup behind the lock
      screen.

Test it:
- [ ] Turn Tailscale off, finish a workout (you get the "Saved…" message), then turn
      Wi-Fi off and on at home. Tailscale connects, StrongLift opens and shows "Backed
      up to T620.", and about a minute later Tailscale disconnects.

## 6. Clean up

- [ ] **Restore** from the T620 backup, or **Import** the JSON export, that you made at
      the start. Deleting the practice sessions in History isn't enough, because it
      doesn't undo the weight increases they caused.
- [ ] Check Home shows your real weights again.

## If something fails

Note which step failed, what you saw, and whether Spotify or the watch was involved.
That's enough to start fixing it.
