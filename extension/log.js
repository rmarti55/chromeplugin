// Structured console logging for Daily Mirror extension backend.
// Filter DevTools with: [DailyMirror]
// Full hot-path verbosity: chrome.storage.local.set({ dmLogVerbose: true })

const PREFIX = "[DailyMirror]";
const VERBOSE_KEY = "dmLogVerbose";

let verbose = false;
let verboseInitStarted = false;

function initVerboseFlag() {
  if (verboseInitStarted) return;
  verboseInitStarted = true;
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  chrome.storage.local.get(VERBOSE_KEY, (result) => {
    verbose = !!result?.[VERBOSE_KEY];
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[VERBOSE_KEY]) return;
    verbose = !!changes[VERBOSE_KEY].newValue;
  });
}

initVerboseFlag();

/** True when dmLogVerbose is set in chrome.storage.local. */
export function isDmVerbose() {
  return verbose;
}

function compactFields(fields) {
  if (!fields || typeof fields !== "object") return "";
  const keys = Object.keys(fields);
  if (keys.length === 0) return "";
  try {
    return ` ${JSON.stringify(fields)}`;
  } catch {
    return " [unserializable]";
  }
}

function emit(method, area, op, fields = {}, singleArg = false) {
  const msg = `${PREFIX} ${area}.${op}${compactFields(fields)}`;
  if (singleArg) method(msg);
  else method(msg, fields);
}

export function dmLog(area, op, fields) {
  emit(console.log, area, op, fields);
}

/** Hot-path / debug-only success logs — silent unless dmLogVerbose is on. */
export function dmDebug(area, op, fields) {
  if (!verbose) return;
  emit(console.log, area, op, fields);
}

export function dmWarn(area, op, fields) {
  emit(console.warn, area, op, fields, true);
}

export function dmError(area, op, fields) {
  emit(console.error, area, op, fields, true);
}

export async function dmTimed(area, op, asyncFn, extra = {}) {
  const start = performance.now();
  try {
    const result = await asyncFn();
    const ms = Math.round(performance.now() - start);
    dmLog(area, op, { ok: true, ms, ...extra });
    return result;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    dmError(area, op, { ok: false, ms, err: err?.message || String(err), ...extra });
    throw err;
  }
}

/** Log only when serialized state changes. */
export function dmOnChange(key, nextState, logFn) {
  if (!dmOnChange._cache) dmOnChange._cache = new Map();
  const serialized = JSON.stringify(nextState);
  const prev = dmOnChange._cache.get(key);
  if (prev === serialized) return false;
  dmOnChange._cache.set(key, serialized);
  logFn(nextState);
  return true;
}

/** Rate-limit repetitive success logs (failures always pass through). */
export function dmRateLimited(key, intervalMs, logFn) {
  if (!dmRateLimited._cache) dmRateLimited._cache = new Map();
  const now = Date.now();
  const last = dmRateLimited._cache.get(key) || 0;
  if (now - last < intervalMs) return false;
  dmRateLimited._cache.set(key, now);
  logFn();
  return true;
}

export function errMsg(err) {
  return err?.message || String(err);
}
