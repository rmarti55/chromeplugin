import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSessions,
  computeOpenSessions,
  computePresenceSeconds,
  computeHourly,
  computeHourlyPresence,
  mergeSessionsWithOpen,
  aggregateOpenByDomain,
  formatDuration,
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

function buildDayMetricsShape(events, dayStart, dayEnd, now) {
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
    activeSeconds,
    openSeconds: presenceSeconds,
    sessions: sessionsWithOpen,
    openByDomain,
    timeline,
  };
}

for (const file of readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"))) {
  test(`session derivation golden: ${file}`, () => {
    const fixture = loadFixture(join(FIXTURE_DIR, file));
    const golden = JSON.parse(readFileSync(join(GOLDEN_DIR, file), "utf8"));
    const { events, dayStart, dayEnd, now } = fixture;

    assert.deepEqual(computeSessions(events, dayStart, dayEnd, now), golden.computeSessions);
    assert.deepEqual(computeOpenSessions(events, dayStart, dayEnd, now), golden.computeOpenSessions);
    assert.equal(computePresenceSeconds(events, dayStart, dayEnd, now), golden.computePresenceSeconds);
    assert.deepEqual(computeHourly(events, dayStart, dayEnd, now), golden.computeHourly);
    assert.deepEqual(
      serializeHourlyPresence(computeHourlyPresence(events, dayStart, dayEnd, now)),
      golden.computeHourlyPresence
    );
    assert.deepEqual(buildDayMetricsShape(events, dayStart, dayEnd, now), golden.dayMetricsShape);
  });
}

// Ensure db.js facade re-exports match session-derive.js directly.
test("db.js re-exports match session-derive.js", async () => {
  const db = await import("./db.js");
  const file = "basic-active.json";
  const fixture = loadFixture(join(FIXTURE_DIR, file));
  const { events, dayStart, dayEnd, now } = fixture;

  assert.deepEqual(db.computeSessions(events, dayStart, dayEnd, now), computeSessions(events, dayStart, dayEnd, now));
  assert.equal(db.formatDuration(3661), formatDuration(3661));
});
