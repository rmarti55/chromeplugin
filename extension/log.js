// Structured console logging for Daily Mirror extension backend.
// Filter DevTools with: [DailyMirror]

const PREFIX = "[DailyMirror]";

function fmt(area, op, fields = {}) {
  return { area, op, ...fields };
}

export function dmLog(area, op, fields) {
  console.log(PREFIX, fmt(area, op, fields));
}

export function dmWarn(area, op, fields) {
  console.warn(PREFIX, fmt(area, op, fields));
}

export function dmError(area, op, fields) {
  console.error(PREFIX, fmt(area, op, fields));
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
