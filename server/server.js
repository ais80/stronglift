// server.js — minimal backup/restore endpoint for StrongLift, meant to run on the T620
// behind Tailscale (same pattern as the fivextracker project's server — see that repo's
// server/Application.kt for the sibling implementation). Single user, so a flat JSON file
// is enough; no database, no framework, no dependencies — just Node's built-in http/fs.
//
// Auth is a shared-secret header (X-Api-Key), not anything heavier, because this is meant
// to sit on a private Tailscale network, never exposed to the open internet.
//
// CORS is wide open (Access-Control-Allow-Origin: *) because the page calling this can be
// served from anywhere (GitHub Pages today, maybe elsewhere later) and the real gate is the
// API key, not the browser's origin check.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8093;
const API_KEY = process.env.BACKUP_API_KEY;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "data");
const BACKUP_FILE = path.join(BACKUP_DIR, "backup.json");
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB — generous for a workout-log JSON blob

if (!API_KEY) {
  console.error("BACKUP_API_KEY is not set — refusing to start with no auth.");
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
}

function authed(req) {
  return req.headers["x-api-key"] === API_KEY;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.url === "/backup" && (req.method === "PUT" || req.method === "GET")) {
    if (!authed(req)) {
      res.writeHead(401);
      res.end();
      return;
    }

    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        JSON.parse(body); // validate it's real JSON before trusting it to disk
        fs.writeFileSync(BACKUP_FILE, body, "utf8");
        res.writeHead(200);
        res.end();
      } catch (e) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end(`Bad request: ${e.message}`);
      }
      return;
    }

    // GET
    if (!fs.existsSync(BACKUP_FILE)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(fs.readFileSync(BACKUP_FILE, "utf8"));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`stronglift-sync listening on :${PORT}, backups in ${BACKUP_DIR}`);
});
