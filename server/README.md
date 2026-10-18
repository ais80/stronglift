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

2. **Create `server/.env`** (gitignored — never committed) with the API key. Use the
   same value that's already in `server/.env` on this machine (`C:\Users\asifs\Downloads\
   StrongLift\server\.env`) so both ends agree, or generate a fresh one:
   ```bash
   echo "BACKUP_API_KEY=$(openssl rand -hex 24)" > .env
   cat .env   # copy this value into the app's Settings -> T620 sync -> API key
   ```

3. **Build and run** (fits alongside the existing stack — `riven` has 8090, `riven-frontend` 8091,
   `fivextracker-server` 8092, `mediafusion-api` 8093, `macrotracker-frontend` 8094 — this uses 8096):
   ```bash
   docker compose up -d --build
   curl http://localhost:8096/health   # expect: ok
   ```

4. **Expose it over HTTPS via Tailscale** so the PWA (running on HTTPS) can reach it
   without a mixed-content block:
   ```bash
   tailscale serve --bg 8444 http://localhost:8096
   tailscale serve status   # confirm it's mapped
   ```
   This makes it reachable tailnet-wide at `https://t620.tail76b543.ts.net:8444`
   (run `tailscale status` on any device in the tailnet to see the exact `.ts.net`
   suffix — it was `tail76b543.ts.net` as of this writing). Verify from any
   Tailscale-connected device:
   ```bash
   curl https://t620.tail76b543.ts.net:8444/health   # expect: ok
   ```
   (If your Tailscale version's `serve` syntax differs from the above, run
   `tailscale serve --help` — the subcommand's flags have changed across versions.)

5. **In the StrongLift app** (Settings → T620 sync): your phone needs Tailscale
   connected too. Set:
   - **Server URL**: `https://t620.tail76b543.ts.net:8444`
   - **API key**: the value from this server's `.env`

   Then **Backup now** to push, or **Restore from T620** to pull (this replaces
   everything on the current device — it asks for confirmation first).

## What it stores

The exact JSON `state.exportJSON()` produces in the app — same shape as a manual
Settings → Export JSON file, just parked on the T620 instead of downloaded. `PUT
/backup` overwrites it; `GET /backup` returns it; `GET /health` is a liveness check.
No history of backups is kept — each `PUT` replaces the last one, same as
`fivextracker`'s server.

## Auto-sync

Settings has an "Auto-sync after finishing a workout" toggle (on by default once a
server URL is set). After **Finish workout**, it fires a background `PUT` — silent on
failure (e.g. you're not on Tailscale right now), a small "Synced to T620" toast on
success. There's no Wi-Fi-SSID trigger like `fivextracker`'s native auto-backup — a web
page can't read the SSID — so this just tries every time and quietly no-ops if the
server isn't reachable.
