// IndexedDB wrapper — the single source of truth for activity.
//
// Design note: we store raw *events* (a durable append-only log) and derive
// per-URL sessions at read time. Nothing depends on an in-memory counter
// surviving, so the MV3 service worker can be killed at any moment without
// losing tracked time. This module is a plain ES module with no DOM/chrome
// dependencies, so it is imported by both the service worker and the dashboard.

import { computeDomainHints, domainHintsToObject } from "./heuristics.js";

const DB_NAME = "chrome-activity";
const DB_VERSION = 1;

// Ignore any single interval longer than this (ms). Guards against counting
// time when the browser was left focused but an idle event was missed (e.g. the
// service worker died and the laptop was closed without a lock event).
const MAX_GAP_MS = 30 * 60 * 1000;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("ts", "ts", { unique: false });
      }
      if (!db.objectStoreNames.contains("analyses")) {
        db.createObjectStore("analyses", { keyPath: "date" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Events -----------------------------------------------------------------

export async function putEvent(ev) {
  const db = await openDB();
  return reqToPromise(tx(db, "events", "readwrite").add(ev));
}

// All events with ts in [startTs, endTs), ordered by ts ascending.
export async function getEventsInRange(startTs, endTs) {
  const db = await openDB();
  const index = tx(db, "events", "readonly").index("ts");
  const range = IDBKeyRange.bound(startTs, endTs, false, true);
  return new Promise((resolve, reject) => {
    const out = [];
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// The single most recent event strictly before ts (to know the active state at
// the start of a day). Returns null if none.
export async function getLastEventBefore(ts) {
  const db = await openDB();
  const index = tx(db, "events", "readonly").index("ts");
  const range = IDBKeyRange.upperBound(ts, true);
  return new Promise((resolve, reject) => {
    const cursorReq = index.openCursor(range, "prev");
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      resolve(cursor ? cursor.value : null);
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Delete events older than the cutoff (retention housekeeping).
export async function pruneEventsBefore(ts) {
  const db = await openDB();
  const index = tx(db, "events", "readwrite").index("ts");
  const range = IDBKeyRange.upperBound(ts, true);
  return new Promise((resolve, reject) => {
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// --- Day math ---------------------------------------------------------------

// Local-time bounds for a "YYYY-MM-DD" string (midnight to next local midnight).
export function dayBounds(dateStr) {
  const start = new Date(dateStr + "T00:00:00").getTime();
  const nextMidnight = new Date(start);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  return { start, end: nextMidnight.getTime() };
}

export function fingerprintsMatch(a, b) {
  if (!a || !b) return false;
  return (
    a.activeSeconds === b.activeSeconds &&
    a.openSeconds === b.openSeconds &&
    a.lastEventTs === b.lastEventTs
  );
}

export async function getLastEventTsInDay(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const events = await getEventsInRange(start, Math.min(end, now + 1));
  return events.length ? events[events.length - 1].ts : null;
}

export function toDateStr(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Human duration with second precision: "8s", "5m 12s", "1h 4m".
export function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

// Clock-hour label for a timestamp: "9am", "12pm", "2pm".
function formatHour(ts) {
  const h = new Date(ts).getHours();
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

// --- Session derivation (pure) ---------------------------------------------

function applyEvent(state, ev, mode = "active") {
  switch (ev.type) {
    case "activate":
    case "urlchange":
    case "focus":
    case "active":
      if (ev.url) {
        state.url = ev.url;
        state.domain = ev.domain;
        state.title = ev.title;
      } else {
        state.url = null;
        state.domain = null;
        state.title = null;
      }
      state.counting = true;
      break;
    case "blur":
    case "locked":
      state.counting = false;
      break;
    case "idle":
      if (mode === "active") state.counting = false;
      break;
  }
}

function applyPresenceEvent(state, ev) {
  switch (ev.type) {
    case "activate":
    case "urlchange":
    case "focus":
    case "active":
      state.counting = true;
      break;
    case "blur":
    case "locked":
      state.counting = false;
      break;
    case "idle":
      break;
  }
}

// Total seconds Chrome was the focused app (idle reading still counts).
export function computePresenceSeconds(events, dayStart, dayEnd, now) {
  const clipHi = Math.min(dayEnd, now ?? dayEnd);
  const state = { counting: false };
  let lastTs = null;
  let total = 0;

  const accrue = (untilTs) => {
    if (lastTs === null || !state.counting) return;
    if (untilTs - lastTs > MAX_GAP_MS) return;
    const a = Math.max(lastTs, dayStart);
    const b = Math.min(untilTs, clipHi);
    if (b > a) total += (b - a) / 1000;
  };

  for (const ev of events) {
    accrue(ev.ts);
    applyPresenceEvent(state, ev);
    lastTs = ev.ts;
  }
  accrue(clipHi);
  return Math.round(total);
}

// Reduce an ordered event list into per-URL sessions for a day.
// `events` MUST include one event preceding dayStart (if any) so we know the
// active state at the day boundary. `now` caps counting for the live/today view.
export function computeSessions(events, dayStart, dayEnd, now) {
  const clipHi = Math.min(dayEnd, now ?? dayEnd);
  const byUrl = new Map(); // url -> { url, domain, title, seconds, visits }

  const touch = (url, domain, title) => {
    let s = byUrl.get(url);
    if (!s) {
      s = { url, domain, title, seconds: 0, visits: 0 };
      byUrl.set(url, s);
    }
    if (title) s.title = title;
    return s;
  };

  const state = { url: null, domain: null, title: null, counting: false };
  let lastTs = null;
  let lastVisitUrl = null;
  let afterBoundary = false;

  const accrue = (untilTs) => {
    if (lastTs === null || !state.counting || !state.url) return;
    if (untilTs - lastTs > MAX_GAP_MS) return; // missed idle guard
    const a = Math.max(lastTs, dayStart);
    const b = Math.min(untilTs, clipHi);
    const durMs = b - a;
    if (durMs > 0) touch(state.url, state.domain, state.title).seconds += durMs / 1000;
  };

  for (const ev of events) {
    accrue(ev.ts);
    // Visits = real navigations only (urlchange), not tab switches or focus returns.
    if (ev.type === "urlchange" && ev.url) {
      if (afterBoundary || ev.url !== lastVisitUrl) {
        touch(ev.url, ev.domain, ev.title).visits += 1;
        lastVisitUrl = ev.url;
        afterBoundary = false;
      }
    }
    if (["blur", "idle", "locked"].includes(ev.type)) {
      afterBoundary = true;
    }
    applyEvent(state, ev);
    lastTs = ev.ts;
  }
  // Tail: from the last event up to "now" (only matters for today).
  accrue(clipHi);

  const sessions = [...byUrl.values()]
    .map((s) => ({ ...s, seconds: Math.round(s.seconds) }))
    .filter((s) => s.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);

  return sessions;
}

// Reduce events into a per-clock-hour timeline derived from REAL timestamps
// (never invented). Each returned entry is { hour: "2pm", activity } where
// activity names the top domain(s) active that hour with their measured time,
// so it can never be "Unknown". Same shape Timeline.jsx already renders.
export function computeHourly(events, dayStart, dayEnd, now) {
  const clipHi = Math.min(dayEnd, now ?? dayEnd);
  const hours = new Map(); // hourStartTs -> Map(domain -> seconds)
  const state = { url: null, domain: null, title: null, counting: false };
  let lastTs = null;

  const addChunk = (from, to) => {
    let cur = from;
    while (cur < to) {
      const d = new Date(cur);
      d.setMinutes(0, 0, 0);
      const hs = d.getTime();
      const chunkEnd = Math.min(to, hs + 3600000);
      let m = hours.get(hs);
      if (!m) {
        m = new Map();
        hours.set(hs, m);
      }
      m.set(state.domain, (m.get(state.domain) || 0) + (chunkEnd - cur) / 1000);
      cur = chunkEnd;
    }
  };
  const accrue = (untilTs) => {
    if (lastTs === null || !state.counting || !state.domain) return;
    if (untilTs - lastTs > MAX_GAP_MS) return;
    const a = Math.max(lastTs, dayStart);
    const b = Math.min(untilTs, clipHi);
    if (b > a) addChunk(a, b);
  };

  for (const ev of events) {
    accrue(ev.ts);
    applyEvent(state, ev);
    lastTs = ev.ts;
  }
  accrue(clipHi);

  return [...hours.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hs, m]) => {
      const domains = [...m.entries()]
        .map(([domain, seconds]) => ({ domain, seconds: Math.round(seconds) }))
        .filter((d) => d.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds);
      const total = domains.reduce((s, d) => s + d.seconds, 0);
      const activity = domains
        .slice(0, 2)
        .map((d) => `${d.domain} (${formatDuration(d.seconds)})`)
        .join(", ");
      return { hour: formatHour(hs), activity, total, domains };
    })
    .filter((h) => h.total > 0);
}

// Load events for a day (including the preceding boundary event).
export async function getEventsForDay(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const [preceding, dayEvents] = await Promise.all([
    getLastEventBefore(start),
    getEventsInRange(start, Math.min(end, now + 1)),
  ]);
  return preceding ? [preceding, ...dayEvents] : dayEvents;
}

// Convenience: load a day's events (incl. the preceding one) and reduce them.
export async function getSessionsForDay(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const events = await getEventsForDay(dateStr, now);
  return computeSessions(events, start, end, now);
}

export async function getDomainHintsForDay(dateStr, now = Date.now()) {
  const events = await getEventsForDay(dateStr, now);
  return domainHintsToObject(computeDomainHints(events));
}

// All day metrics from one event load.
export async function getDayMetrics(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const events = await getEventsForDay(dateStr, now);
  const sessions = computeSessions(events, start, end, now);
  const activeSeconds = sessions.reduce((s, x) => s + x.seconds, 0);
  const openSeconds = computePresenceSeconds(events, start, end, now);
  const domainHints = domainHintsToObject(computeDomainHints(events));
  const topDomains = aggregateByDomain(sessions, domainHints);
  const timeline = computeHourly(events, start, end, now);
  return {
    activeSeconds,
    openSeconds,
    sessions,
    topDomains,
    timeline,
    domainHints,
  };
}

// Same, but for the hourly timeline.
export async function getHourlyForDay(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const [preceding, dayEvents] = await Promise.all([
    getLastEventBefore(start),
    getEventsInRange(start, Math.min(end, now + 1)),
  ]);
  const events = preceding ? [preceding, ...dayEvents] : dayEvents;
  return computeHourly(events, start, end, now);
}

// What is being captured right now, from the durable log. The most recent event
// fully determines state: url-setters imply "counting", pause events imply
// stopped. Used by the live indicator in the popup and dashboard.
export async function getCurrentActivity(now = Date.now()) {
  const last = await getLastEventBefore(now + 1);
  if (!last) return { status: "idle" };
  if (["blur", "idle", "locked"].includes(last.type)) return { status: "paused" };
  if (last.url) {
    const elapsedSeconds = Math.round(Math.min(now - last.ts, MAX_GAP_MS) / 1000);
    return {
      status: "capturing",
      domain: last.domain,
      url: last.url,
      title: last.title || "",
      sinceTs: last.ts,
      elapsedSeconds,
    };
  }
  // active-type event on a non-web page (chrome://, blank): nothing to track.
  return { status: "paused" };
}

// Aggregate sessions by domain for top-sites / category views.
export function aggregateByDomain(sessions, domainHints = {}) {
  const byDomain = new Map();
  for (const s of sessions) {
    let d = byDomain.get(s.domain);
    if (!d) {
      const hint = domainHints[s.domain] || {};
      d = {
        domain: s.domain,
        seconds: 0,
        visits: 0,
        automationHint: hint.automationHint || "none",
        hintNote: hint.hintNote || null,
      };
      byDomain.set(s.domain, d);
    }
    d.seconds += s.seconds;
    d.visits += s.visits;
  }
  return [...byDomain.values()]
    .map((d) => ({
      domain: d.domain,
      seconds: d.seconds,
      minutes: Math.round(d.seconds / 60),
      visits: d.visits,
      automationHint: d.automationHint,
      hintNote: d.hintNote,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

// Build HistoryEntry[] (the shape the AI prompt expects) from measured sessions.
export function sessionsToHistoryEntries(sessions) {
  return sessions.map((s) => ({
    url: s.url,
    title: s.title || "",
    domain: s.domain,
    visitTime: 0,
    duration: s.seconds, // measured seconds, not an estimate
    visitCount: s.visits,
  }));
}

// --- Analyses ---------------------------------------------------------------

export async function saveAnalysis(analysis) {
  const db = await openDB();
  return reqToPromise(tx(db, "analyses", "readwrite").put(analysis));
}

export async function getAnalysis(dateStr) {
  const db = await openDB();
  const result = await reqToPromise(tx(db, "analyses", "readonly").get(dateStr));
  return result || null;
}

export async function listAnalysisDays() {
  const db = await openDB();
  const keys = await reqToPromise(tx(db, "analyses", "readonly").getAllKeys());
  return keys.sort().reverse();
}

// Distinct local dates that have any recorded activity (for date navigation).
export async function listActivityDays() {
  const db = await openDB();
  const index = tx(db, "events", "readonly").index("ts");
  return new Promise((resolve, reject) => {
    const days = new Set();
    const cursorReq = index.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        days.add(toDateStr(cursor.value.ts));
        cursor.continue();
      } else {
        resolve([...days].sort().reverse());
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
