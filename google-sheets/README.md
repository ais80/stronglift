# Google Sheet sync

StrongLift keeps a copy of everything in a Google Sheet you own. The app syncs when it
opens, when you switch back to it, and a couple of seconds after any change. Each sync
reads the sheet, merges it with what's on the phone, then writes the result back. If
the phone's storage is cleared or you get a new phone, paste the sync link back in and
everything comes back.

The sheet gets these tabs:

| Tab | What's in it |
| --- | --- |
| **Workouts** | One readable row per lift per session: date, weight, reps, hit/miss, warm-ups |
| **Progress** | Current working weight for every lift |
| **Snapshots** | The last 50 saves. Use **StrongLift → Restore the selected snapshot** to roll back |
| **State** | The app's raw data. Don't edit it |

## Setup (about 5 minutes, once)

1. Make a new Google Sheet (sheets.new) and name it, e.g. *StrongLift*.
2. **Extensions → Apps Script**. Delete what's in `Code.gs` and paste in the contents of
   [`Code.gs`](Code.gs) from this folder. Save.
3. In the toolbar's function menu pick **setup**, then **Run**. Approve the permissions
   prompt. Google warns that the app "isn't verified" because it's your own script: choose
   **Advanced → Go to (project name)**. The **Execution log** then shows `Your key: …`.
4. **Deploy → New deployment**. Click the cog next to *Select type* and choose **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**. The app has no Google sign-in, so this is required.
     The key is what keeps other people out.
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Your **sync link** is that URL plus `?key=` plus the key from step 3:
   `https://script.google.com/macros/s/AKfy…/exec?key=3f9c…`
   Save it somewhere you won't lose it, such as a note in Google Keep or a password manager.
6. On the phone: StrongLift → **Settings → Google Sheet sync**. Paste the link, then tap
   **Sync now**. Within a few seconds the sheet's tabs fill in.

If you later change `Code.gs`, choose **Deploy → Manage deployments → Edit → Version: New
version** so the URL stays the same.

## How it decides what wins

- **Workout history** is always merged. A session on either side is kept unless it was
  deleted in the app.
- **Weights, settings and lifts** come from whichever side changed most recently. The one
  exception is a phone that has never synced, for example one just wiped back to 20kg
  defaults: it always takes the sheet's copy.
- The app never writes to the sheet before it has read from it, so a wiped phone can't
  overwrite good data.

## Troubleshooting

- *"The sheet didn't answer with data"*: the deployment isn't set to **Anyone**, or the
  URL is the editor's URL rather than the `/exec` one.
- *"Wrong or missing key"*: the `?key=` part doesn't match. Run **setup** again to see the key.
- *Offline at the gym*: changes wait on the phone and go up the next time the app is
  open with a connection.
