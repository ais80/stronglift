// Code.gs — StrongLift's sync endpoint, run as a Google Apps Script web app bound to a
// Google Sheet (setup: README.md next to this file). The app calls it with:
//   GET  <web app url>?key=SECRET&action=get  -> { ok, state }   (state is null if empty)
//   POST <web app url>?key=SECRET&action=put  body: the whole state JSON -> { ok, savedAt }
// The app merges before every put (js/state.js mergeStates), so this side just stores.
//
// Tabs it keeps:
//   State      the full app state as JSON, split into cells (a cell holds ~50k chars).
//   Snapshots  the last SNAPSHOTS_KEPT states, newest at the bottom: undo for anything.
//   Workouts   one readable row per exercise per session (rebuilt on each save).
//   Progress   current working weight per lift (rebuilt on each save).

const CHUNK = 45000;
// Each stored chunk starts with this so Sheets keeps it as text: a chunk that happened to
// begin with "=" or look like a number or date would otherwise be converted.
const MARK = "~";
const SNAPSHOTS_KEPT = 50;

/** Run once from the editor: creates the tabs and a secret key, and logs the key. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty("SYNC_KEY");
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("SYNC_KEY", key);
  }
  ["State", "Snapshots", "Workouts", "Progress"].forEach(sheet_);
  Logger.log("Your key: " + key);
  Logger.log("Sync link = the web app URL (Deploy > Manage deployments) + ?key=" + key);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("StrongLift").addItem("Restore the selected snapshot", "restoreSnapshot").addToUi();
}

/**
 * Make the snapshot on the selected row of Snapshots the current state. It's stamped as
 * the newest change, so the phone takes its lifts/weights/settings on its next sync
 * (workout history is always merged, so later sessions stay).
 */
function restoreSnapshot() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  const row = sh.getActiveRange() && sh.getActiveRange().getRow();
  if (sh.getName() !== "Snapshots" || !row) return ui.alert("Select a row on the Snapshots tab first.");
  const values = sh.getRange(row, 2, 1, Math.max(1, sh.getLastColumn() - 1)).getValues()[0];
  const state = JSON.parse(unchunk_(values));
  state.updatedAt = Date.now();
  if (ui.alert("Restore the snapshot from " + sh.getRange(row, 1).getValue() + "?", ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  const text = JSON.stringify(state);
  writeState_(text);
  addSnapshot_(text);
  writeWorkouts_(state);
  writeProgress_(state);
  ui.alert("Restored. Open StrongLift (or tap Sync now) to pull it onto the phone.");
}

function doGet(e) {
  return handle_(e, () => ({ ok: true, state: readState_() }));
}

function doPost(e) {
  return handle_(e, () => {
    const state = JSON.parse(e.postData.contents);
    if (!state || !Array.isArray(state.history)) throw new Error("That isn't a StrongLift state.");
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const text = JSON.stringify(state);
      writeState_(text);
      addSnapshot_(text);
      writeWorkouts_(state);
      writeProgress_(state);
    } finally {
      lock.releaseLock();
    }
    return { ok: true, savedAt: Date.now() };
  });
}

function handle_(e, fn) {
  let out;
  try {
    const key = PropertiesService.getScriptProperties().getProperty("SYNC_KEY");
    if (!key || !e || !e.parameter || e.parameter.key !== key) throw new Error("Wrong or missing key in the sync link.");
    out = fn();
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function chunks_(text) {
  const out = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push(MARK + text.slice(i, i + CHUNK));
  return out;
}

function unchunk_(cells) {
  return cells.filter((c) => typeof c === "string" && c.charAt(0) === MARK).map((c) => c.slice(1)).join("");
}

function readState_() {
  const sh = sheet_("State");
  const last = sh.getLastRow();
  if (last < 2) return null;
  const text = unchunk_(sh.getRange(2, 1, last - 1, 1).getValues().map((r) => r[0]));
  return text ? JSON.parse(text) : null;
}

function writeState_(text) {
  const sh = sheet_("State");
  sh.clear();
  const parts = chunks_(text);
  sh.getRange(1, 1).setValue("Saved " + new Date().toISOString() + " — app data, don't edit");
  sh.getRange(2, 1, parts.length, 1).setValues(parts.map((p) => [p]));
}

function addSnapshot_(text) {
  const sh = sheet_("Snapshots");
  const parts = chunks_(text);
  sh.appendRow([new Date()].concat(parts));
  const extra = sh.getLastRow() - SNAPSHOTS_KEPT;
  if (extra > 0) sh.deleteRows(1, extra);
}

function nameOf_(state, id) {
  const ex = (state.exercises || []).find((x) => x.id === id);
  return ex ? ex.name : id;
}

function writeWorkouts_(state) {
  const units = (state.settings && state.settings.units) || "kg";
  const rows = [["Date", "Day", "Exercise", "Weight (" + units + ")", "Reps per set", "Result", "Next weight", "Warm-ups", "Minutes"]];
  state.history.forEach((h) => {
    (h.entries || []).forEach((en) => {
      rows.push([
        new Date(h.date),
        h.day,
        nameOf_(state, en.exerciseId),
        en.targetWeight,
        (en.sets || []).map((s) => s.reps).join(" / "),
        en.success ? "Hit" : "Missed",
        en.nextWeight,
        (en.warmups || []).map((w) => w.weight + "×" + w.reps).join(", "),
        Math.round((h.durationSecs || 0) / 60),
      ]);
    });
  });
  const sh = sheet_("Workouts");
  sh.clear();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function writeProgress_(state) {
  const units = (state.settings && state.settings.units) || "kg";
  const rows = [["Lift", "Working weight (" + units + ")", "Misses in a row"]];
  Object.keys(state.progress || {}).forEach((id) => {
    const p = state.progress[id];
    rows.push([nameOf_(state, id), p.currentWeight, p.consecutiveFailures]);
  });
  const sh = sheet_("Progress");
  sh.clear();
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight("bold");
  sh.setFrozenRows(1);
}
