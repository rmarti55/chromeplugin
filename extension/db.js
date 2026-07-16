// IndexedDB wrapper — the single source of truth for activity.
//
// Design note: we store raw *events* (a durable append-only log) and derive
// per-URL sessions at read time. Nothing depends on an in-memory counter
// surviving, so the MV3 service worker can be killed at any moment without
// losing tracked time. This module is a plain ES module with no DOM/chrome
// dependencies, so it is imported by both the service worker and the dashboard.

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

// Local-time bounds for a "YYYY-MM-DD" string.
export function dayBounds(dateStr) {
  const start = new Date(dateStr + "T00:00:00").getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

export function toDateStr(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- Session derivation (pure) ---------------------------------------------

function applyEvent(state, ev) {
  switch (ev.type) {
    case "activate":
    case "urlchange":
    case "focus":
    case "active":
      // A web page → track it. A non-web page (chrome://, blank) carries no
      // url; clear the current url so the *previous* page stops accruing.
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
    case "idle":
    case "locked":
      state.counting = false;
      break;
  }
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
    if (ev.url && ["activate", "urlchange", "focus", "active"].includes(ev.type)) {
      touch(ev.url, ev.domain, ev.title).visits += 1;
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

// Convenience: load a day's events (incl. the preceding one) and reduce them.
export async function getSessionsForDay(dateStr, now = Date.now()) {
  const { start, end } = dayBounds(dateStr);
  const [preceding, dayEvents] = await Promise.all([
    getLastEventBefore(start),
    getEventsInRange(start, Math.min(end, now + 1)),
  ]);
  const events = preceding ? [preceding, ...dayEvents] : dayEvents;
  return computeSessions(events, start, end, now);
}

// Aggregate sessions by domain for top-sites / category views.
export function aggregateByDomain(sessions) {
  const byDomain = new Map();
  for (const s of sessions) {
    let d = byDomain.get(s.domain);
    if (!d) {
      d = { domain: s.domain, seconds: 0, visits: 0 };
      byDomain.set(s.domain, d);
    }
    d.seconds += s.seconds;
    d.visits += s.visits;
  }
  return [...byDomain.values()]
    .map((d) => ({ domain: d.domain, minutes: Math.round(d.seconds / 60), visits: d.visits }))
    .sort((a, b) => b.minutes - a.minutes);
}

// Build HistoryEntry[] (the shape the AI prompt expects) from measured sessions.
export function sessionsToHistoryEntries(sessions) {
  return sessions.map((s) => ({
    url: s.url,
    title: s.title || "",
    domain: s.domain,
    visitTime: 0,
    duration: s.seconds, // measured seconds, not an estimate
    visitCount: s.visits || 1,
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
