// One-off: capture golden outputs from current session derivation.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeSessions,
  computeOpenSessions,
  computePresenceSeconds,
  computeHourly,
  computeHourlyPresence,
  mergeSessionsWithOpen,
  aggregateOpenByDomain,
} from "./session-derive.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "testdata/day-events");
const GOLDEN_DIR = join(__dirname, "testdata/golden");

function parseTs(s) {
  return new Date(s).getTime();
}

function loadFixture(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return {
    ...raw,
    dayStart: parseTs(raw.dayStart),
    dayEnd: parseTs(raw.dayEnd),
    now: parseTs(raw.now),
    events: raw.events.map((ev) => ({ ...ev, ts: parseTs(ev.ts) })),
  };
}

function serializeHourlyPresence(map) {
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function capture(fixture) {
  const { events, dayStart, dayEnd, now } = fixture;
  const sessions = computeSessions(events, dayStart, dayEnd, now);
  const openSessions = computeOpenSessions(events, dayStart, dayEnd, now);
  const presenceSeconds = computePresenceSeconds(events, dayStart, dayEnd, now);
  const hourly = computeHourly(events, dayStart, dayEnd, now);
  const hourlyPresence = computeHourlyPresence(events, dayStart, dayEnd, now);
  const sessionsWithOpen = mergeSessionsWithOpen(sessions, openSessions);
  const activeSeconds = sessions.reduce((s, x) => s + x.seconds, 0);
  const openByDomain = aggregateOpenByDomain(openSessions);
  const timeline = hourly.map((entry) => ({
    ...entry,
    openSeconds: Math.round(hourlyPresence.get(entry.hourStartTs) || 0),
  }));

  return {
    computeSessions: sessions,
    computeOpenSessions: openSessions,
    computePresenceSeconds: presenceSeconds,
    computeHourly: hourly,
    computeHourlyPresence: serializeHourlyPresence(hourlyPresence),
    dayMetricsShape: {
      activeSeconds,
      openSeconds: presenceSeconds,
      sessions: sessionsWithOpen,
      openByDomain,
      timeline,
    },
  };
}

for (const file of readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"))) {
  const fixture = loadFixture(join(FIXTURE_DIR, file));
  const golden = capture(fixture);
  writeFileSync(join(GOLDEN_DIR, file), JSON.stringify(golden, null, 2) + "\n");
  console.log("captured", file);
}
