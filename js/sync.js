// sync.js — talks to the T620 backup server (see server/README.md). Same shape as the
// Settings screen's existing file Export/Import, just over the network instead of a
// downloaded file: PUT the whole exported state, GET it back to restore.
import { exportJSON, importJSON } from "./state.js";

function baseUrl(settings) {
  const url = (settings.syncServerUrl || "").trim();
  if (!url) throw new Error("No sync server configured — set it in Settings.");
  return url.replace(/\/+$/, "");
}

export async function backupToServer(settings) {
  const res = await fetch(`${baseUrl(settings)}/backup`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Api-Key": settings.syncApiKey || "" },
    body: exportJSON(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Returns the same { ok, error? } shape as state.importJSON(). */
export async function restoreFromServer(settings) {
  const res = await fetch(`${baseUrl(settings)}/backup`, {
    method: "GET",
    headers: { "X-Api-Key": settings.syncApiKey || "" },
  });
  if (res.status === 404) return { ok: false, error: "No backup found on the server yet." };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return importJSON(text);
}
