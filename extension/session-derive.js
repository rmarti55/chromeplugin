// Pure session derivation from Chrome activity events.
// No IndexedDB or chrome APIs — safe to import from tests and the dashboard.

import { visitKey } from "./siteIdentity.js";

// Ignore any single interval longer than this (ms). Guards against counting
// time when the browser was left focused but an idle event was missed.
export const MAX_GAP_MS = 30 * 60 * 1000;

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

function formatHour(ts) {
  const h = new Date(ts).getHours();
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

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

function clipHi(dayEnd, now) {
  return Math.min(dayEnd, now ?? dayEnd);
}

function clipInterval(lastTs, untilTs, dayStart, hi) {
  if (lastTs === null) return null;
  if (untilTs - lastTs > MAX_GAP_MS) return null;
  const a = Math.max(lastTs, dayStart);
  const b = Math.min(untilTs, hi);
  if (b <= a) return null;
  return { a, b, ms: b - a };
}

function forEachHourChunk(from, to, fn) {
  let cur = from;
  while (cur < to) {
    const d = new Date(cur);
    d.setMinutes(0, 0, 0);
    const hs = d.getTime();
    const chunkEnd = Math.min(to, hs + 3600000);
    fn(hs, cur, chunkEnd);
    cur = chunkEnd;
  }
}

// Shared event walker: accrue-then-apply with gap clipping and day bounds.
function walkEvents(events, dayStart, dayEnd, now, handlers) {
  const hi = clipHi(dayEnd, now);
  const ctx = handlers.createContext();
  let lastTs = null;

  const accrue = (untilTs) => {
    const interval = clipInterval(lastTs, untilTs, dayStart, hi);
    if (interval) handlers.onAccrue(ctx, interval);
  };

  for (const ev of events) {
    accrue(ev.ts);
    handlers.onEvent(ctx, ev);
    lastTs = ev.ts;
  }
  accrue(hi);
  return handlers.finish(ctx);
}

function createUrlAccrueContext() {
  const byUrl = new Map();
  const touch = (url, domain, title) => {
    let s = byUrl.get(url);
    if (!s) {
      s = { url, domain, title, seconds: 0 };
      byUrl.set(url, s);
    }
    if (title) s.title = title;
    return s;
  };
  return { byUrl, touch, state: { url: null, domain: null, title: null, counting: false } };
}

function finishUrlSessions(ctx, includeVisits = false) {
  return [...ctx.byUrl.values()]
    .map((s) => ({
      ...s,
      seconds: Math.round(s.seconds),
      ...(includeVisits ? { visits: s.visits ?? 0 } : {}),
    }))
    .filter((s) => s.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

// Total seconds Chrome was the focused app (idle reading still counts).
export function computePresenceSeconds(events, dayStart, dayEnd, now) {
  return walkEvents(events, dayStart, dayEnd, now, {
    createContext: () => ({ state: { counting: false }, total: 0 }),
    onAccrue(ctx, { a, b }) {
      if (ctx.state.counting) ctx.total += (b - a) / 1000;
    },
    onEvent(ctx, ev) {
      applyPresenceEvent(ctx.state, ev);
    },
    finish(ctx) {
      return Math.round(ctx.total);
    },
  });
}

export function computeSessions(events, dayStart, dayEnd, now) {
  return walkEvents(events, dayStart, dayEnd, now, {
    createContext() {
      const byUrl = new Map();
      const touch = (url, domain, title) => {
        let s = byUrl.get(url);
        if (!s) {
          s = { url, domain, title, seconds: 0, visits: 0 };
          byUrl.set(url, s);
        }
        if (title) s.title = title;
        return s;
      };
      return {
        byUrl,
        touch,
        state: { url: null, domain: null, title: null, counting: false },
        lastVisitKey: null,
        afterBoundary: false,
      };
    },
    onAccrue(ctx, { ms }) {
      const { state, touch } = ctx;
      if (state.counting && state.url) {
        touch(state.url, state.domain, state.title).seconds += ms / 1000;
      }
    },
    onEvent(ctx, ev) {
      if (ev.type === "urlchange" && ev.url) {
        const key = visitKey(ev.url, ev.domain);
        if (ctx.afterBoundary || key !== ctx.lastVisitKey) {
          ctx.touch(ev.url, ev.domain, ev.title).visits += 1;
          ctx.lastVisitKey = key;
          ctx.afterBoundary = false;
        }
      }
      if (["blur", "idle", "locked"].includes(ev.type)) {
        ctx.afterBoundary = true;
      }
      applyEvent(ctx.state, ev, "active");
    },
    finish(ctx) {
      return finishUrlSessions(ctx, true);
    },
  });
}

export function computeOpenSessions(events, dayStart, dayEnd, now) {
  return walkEvents(events, dayStart, dayEnd, now, {
    createContext: createUrlAccrueContext,
    onAccrue(ctx, { ms }) {
      const { state, touch } = ctx;
      if (state.counting && state.url) {
        touch(state.url, state.domain, state.title).seconds += ms / 1000;
      }
    },
    onEvent(ctx, ev) {
      applyEvent(ctx.state, ev, "open");
    },
    finish(ctx) {
      return finishUrlSessions(ctx, false);
    },
  });
}

export function aggregateOpenByDomain(openSessions) {
  const byDomain = new Map();
  for (const s of openSessions) {
    let d = byDomain.get(s.domain);
    if (!d) {
      d = { domain: s.domain, seconds: 0 };
      byDomain.set(s.domain, d);
    }
    d.seconds += s.seconds;
  }
  return [...byDomain.values()]
    .map((d) => ({ domain: d.domain, seconds: d.seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function mergeSessionsWithOpen(activeSessions, openSessions) {
  const openByUrl = new Map(openSessions.map((s) => [s.url, s.seconds]));
  const merged = activeSessions.map((s) => ({
    ...s,
    openSeconds: openByUrl.get(s.url) || 0,
  }));
  for (const o of openSessions) {
    if (!merged.some((s) => s.url === o.url)) {
      merged.push({
        url: o.url,
        domain: o.domain,
        title: o.title,
        seconds: 0,
        visits: 0,
        openSeconds: o.seconds,
      });
    }
  }
  return merged.sort((a, b) => b.seconds - a.seconds || b.openSeconds - a.openSeconds);
}

export function computeHourly(events, dayStart, dayEnd, now) {
  return walkEvents(events, dayStart, dayEnd, now, {
    createContext() {
      return {
        state: { url: null, domain: null, title: null, counting: false },
        hours: new Map(),
      };
    },
    onAccrue(ctx, { a, b }) {
      const { state, hours } = ctx;
      if (!state.counting || !state.domain) return;
      forEachHourChunk(a, b, (hs, from, to) => {
        let m = hours.get(hs);
        if (!m) {
          m = new Map();
          hours.set(hs, m);
        }
        m.set(state.domain, (m.get(state.domain) || 0) + (to - from) / 1000);
      });
    },
    onEvent(ctx, ev) {
      applyEvent(ctx.state, ev, "active");
    },
    finish(ctx) {
      return [...ctx.hours.entries()]
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
          return { hour: formatHour(hs), hourStartTs: hs, activity, total, domains };
        })
        .filter((h) => h.total > 0);
    },
  });
}

export function computeHourlyPresence(events, dayStart, dayEnd, now) {
  return walkEvents(events, dayStart, dayEnd, now, {
    createContext() {
      return { state: { counting: false }, hours: new Map() };
    },
    onAccrue(ctx, { a, b }) {
      if (!ctx.state.counting) return;
      forEachHourChunk(a, b, (hs, from, to) => {
        ctx.hours.set(hs, (ctx.hours.get(hs) || 0) + (to - from) / 1000);
      });
    },
    onEvent(ctx, ev) {
      applyPresenceEvent(ctx.state, ev);
    },
    finish(ctx) {
      return ctx.hours;
    },
  });
}
