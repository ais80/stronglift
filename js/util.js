// util.js — small formatting/escaping helpers shared across views.

export function fmtWeight(weight, units) {
  const n = Math.round(weight * 100) / 100;
  const trimmed = Number(n.toFixed(2)).toString();
  return `${trimmed} ${units}`;
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return iso;
  }
}

export function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

export function fmtDuration(totalSecs) {
  if (!totalSecs) return "";
  const mins = Math.round(totalSecs / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
