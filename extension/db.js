// IndexedDB wrapper — the single source of truth for activity.
//
// Design note: we store raw *events* (a durable append-only log) and derive
// per-URL sessions at read time. Nothing depends on an in-memory counter
// surviving, so the MV3 service worker can be killed at any moment without
// losing tracked time. This module is a plain ES module with no DOM/chrome
// dependencies, so it is imported by both the service worker and the dashboard.

import { computeDomainHints, domainHintsToObject } from "./heuristics.js";
import {
  MAX_GAP_MS,
  formatDuration,
  computeSessions,
  computeOpenSessions,
  computePresenceSeconds,
  computeHourly,
  computeHourlyPresence,
  aggregateOpenByDomain,
  mergeSessionsWithOpen,
} from "./session-derive.js";

export {
  MAX_GAP_MS,
  formatDuration,
  computeSessions,
  computeOpenSessions,
  computePresenceSeconds,
  computeHourly,
  computeHourlyPresence,
  aggregateOpenByDomain,
  mergeSessionsWithOpen,
} from "./session-derive.js";

const DB_NAME = "chrome-activity";
const DB_VERSION = 1;

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
  if (startTs >= endTs) return [];
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
    a.lastEventTs === b.lastEventTs &&
    (a.devicePresenceSeconds ?? 0) === (b.devicePresenceSeconds ?? 0) &&
    (a.deviceActiveSeconds ?? 0) === (b.deviceActiveSeconds ?? 0) &&
    (a.desktopAppCount ?? 0) === (b.desktopAppCount ?? 0)
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

// American calendar label for UI: "today 7/28", "yesterday 7/27", "the day before 7/26", or "7/25/2026".
export function formatDisplayDate(dateStr, now = Date.now()) {
  const dateMs = new Date(dateStr + "T00:00:00").getTime();
  const todayMs = new Date(toDateStr(now) + "T00:00:00").getTime();
  const offsetDays = Math.round((todayMs - dateMs) / 86400000);
  const d = new Date(dateStr + "T00:00:00");
  const short = `${d.getMonth() + 1}/${d.getDate()}`;
  if (offsetDays === 0) return `today ${short}`;
  if (offsetDays === 1) return `yesterday ${short}`;
  if (offsetDays === 2) return `the day before ${short}`;
  return `${short}/${d.getFullYear()}`;
}

/** Last N local calendar days ending today (newest first). */
export function listRecentCalendarDays(count, now = Date.now()) {
  const days = [];
  const start = new Date(toDateStr(now) + "T00:00:00");
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() - i);
    days.push(toDateStr(d.getTime()));
  }
  return days;
}

/** "active" | "quiet" | "unconfirmed" — quiet = confirmed zero Chrome + reachable Mac with no apps. */
export function classifyDay({
  sessions = [],
  openSeconds = 0,
  activeSeconds = 0,
  desktopAvailable = false,
  desktopFetchOk = false,
}) {
  const chromeActive = sessions.length > 0 || openSeconds > 0 || activeSeconds > 0;
  if (chromeActive || desktopAvailable) return "active";
  if (desktopFetchOk) return "quiet";
  return "unconfirmed";
}

// --- Session derivation (re-exported from session-derive.js) ------------------
// See session-derive.js for computeSessions, computeHourly, etc.

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
  const openSessions = computeOpenSessions(events, start, end, now);
  const sessionsWithOpen = mergeSessionsWithOpen(sessions, openSessions);
  const activeSeconds = sessions.reduce((s, x) => s + x.seconds, 0);
  const openSeconds = computePresenceSeconds(events, start, end, now);
  const openByDomain = aggregateOpenByDomain(openSessions);
  const domainHints = domainHintsToObject(computeDomainHints(events));
  const topDomains = aggregateByDomain(sessions, domainHints);
  const presenceByHour = computeHourlyPresence(events, start, end, now);
  const timeline = computeHourly(events, start, end, now).map((entry) => ({
    ...entry,
    openSeconds: Math.round(presenceByHour.get(entry.hourStartTs) || 0),
  }));
  return {
    activeSeconds,
    openSeconds,
    sessions: sessionsWithOpen,
    topDomains,
    openByDomain,
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
