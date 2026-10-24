# StrongLift sync server (for the T620)

A tiny, dependency-free Node server that stores one JSON blob (your exported StrongLift
state) and hands it back on request. Same pattern as the `fivextracker` project's own
`server/` — flat file, shared-secret header, meant to sit behind Tailscale only, never
exposed to the open internet — just a separate instance/port/key so the two apps'
backups never collide.

## Why HTTPS matters here

StrongLift is served from `https://ais80.github.io/...` (GitHub Pages). A browser will
**block** a plain `fetch("http://...")` call from an HTTPS page as mixed content — so
this server needs to be reachable over HTTPS, not just the raw container port. The
cleanest way to get that without managing certificates yourself is **`tailscale serve`**,
which terminates HTTPS using a cert Tailscale already issues for your tailnet, and only
answers to other devices on your tailnet (not the public internet — unlike `tailscale
funnel`, which would expose it publicly; don't use `funnel` here).

## Deploy on the T620

1. **Get the code onto the T620** — this repo is public, so the simplest path is a
   plain clone (no credentials needed):
   ```bash
   git clone https://github.com/ais80/stronglift.git
   cd stronglift/server
   ```

2. **Create `server/.env`** (gitignored — never committed) saying who may back up.
   The simplest is **Tailscale sign-in, no API key**: list the Tailscale login your
   phone uses (`tailscale whois <phone's 100.x IP>` shows it as `LoginName`):
   ```bash
   echo "ALLOW_TAILSCALE_USERS=you@gmail.com" > .env
   ```
   This works because `tailscale serve` tells the server which tailnet user sent each
   request (the `Tailscale-User-Login` header, which it sets itself, so clients can't
   forge it). `docker-compose.yml` publishes the port on `127.0.0.1` only, so the only
   way in is through `tailscale serve`. Keep that binding; publishing the port on the
   LAN would let anyone there send a fake header.

   Optionally add `BACKUP_API_KEY=<long random string>` too. A request is accepted if it
   has *either* an allowed Tailscale login *or* the key.

3. **Build and run** (fits alongside the existing stack — `riven` has 8090, `riven-frontend` 8091,
   `fivextracker-server` 8092, `mediafusion-api` 8093, `macrotracker-frontend` 8094, Jellyfin (host-networked, invisible to `docker ps`) 8096 — this uses 8095):
   ```bash
   docker compose up -d --build
   curl http://localhost:8095/health   # expect: ok
   ```

4. **Expose it over HTTPS via Tailscale** so the PWA (running on HTTPS) can reach it
   without a mixed-content block:
   ```bash
   tailscale serve --bg --https=9453 http://localhost:8095
   tailscale serve status   # confirm it's mapped
   ```
   This makes it reachable tailnet-wide at `https://t620.tail76b543.ts.net:9453`
   (run `tailscale status` on any device in the tailnet to see the exact `.ts.net`
   suffix — it was `tail76b543.ts.net` as of this writing). Verify from any
   Tailscale-connected device:
   ```bash
   curl https://t620.tail76b543.ts.net:9453/health   # expect: ok
   ```
   (If your Tailscale version's `serve` syntax differs from the above, run
   `tailscale serve --help` — the subcommand's flags have changed across versions.)

5. **In the StrongLift app** (Settings → T620 sync): your phone needs Tailscale
   connected too. Set:
   - **Server URL**: `https://t620.tail76b543.ts.net:9453`
   - **API key**: leave blank (Tailscale sign-in). Only fill it in if you set
     `BACKUP_API_KEY` and want to use it.

   Then **Backup now** to push, or **Restore from T620** to pull (this replaces
   everything on the current device — it asks for confirmation first).

   **The first time, Chrome will block it and the button will just say "Failed to
   fetch".** This is Chrome's own **Local Network Access** permission (same category as
   camera/location — a public page, `ais80.github.io`, reaching a private-network
   address) — a one-time prompt Chrome shows for the site, not a bug. If no prompt
   appears automatically, open Chrome's site settings for `ais80.github.io` (tap the
   padlock/info icon next to the address bar → Permissions, or
   `chrome://settings/content/all` → search the site) and set **"Local network access"**
   to Allow, then retry. (Confirmed live during setup: the server's CORS headers alone
   are necessary but not sufficient — this permission is a separate, additional gate on
   the browser side that no server-side header can skip.)

## What it stores

The exact JSON `state.exportJSON()` produces in the app — same shape as a manual
Settings → Export JSON file, just parked on the T620 instead of downloaded. `PUT
/backup` overwrites it; `GET /backup` returns it; `GET /health` is a liveness check.
No history of backups is kept — each `PUT` replaces the last one, same as
`fivextracker`'s server.

## Auto-sync

Settings has an "Auto-sync after finishing a workout" toggle (on by default once a
server URL is set). After **Finish workout**, it tries a `PUT` straight away. If the
T620 isn't reachable (e.g. you're not on Tailscale), the backup is **queued** and
retried automatically: when the app opens or comes to the front, on a network change,
every minute while it's open, and via Chrome's Background Sync with the app closed.

A web page can't read the Wi-Fi SSID or switch a VPN, so the "on home Wi-Fi" trigger
lives in MacroDroid: connect Tailscale, open the app's `#/backup` link (also the **Back
up to T620** home-screen shortcut), wait, then disconnect. See `TESTING.md` §5.
