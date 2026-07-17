// Merge Chrome extension metrics with macOS companion day payload.
// Dedup: Chrome site minutes stay extension-owned; desktop rollup treats Chrome as one app.

import { formatDuration } from "./db.js";
import { isChromeApp } from "./desktop-bridge.js";
import { categorizeApps } from "./categorize-apps.js";

export function mergeDesktopWithChrome(chromeMetrics, desktopPayload) {
  if (!desktopPayload?.apps?.length) {
    return {
      available: false,
      devicePresenceSeconds: chromeMetrics.openSeconds || 0,
      deviceActiveSeconds: chromeMetrics.activeSeconds || 0,
      otherApps: [],
      chromeApp: null,
      categories: [],
      mergedTimeline: chromeMetrics.timeline || [],
      syncedDevices: [],
    };
  }

  const apps = desktopPayload.apps || [];
  const chromeApp = apps.find((a) => isChromeApp(a.bundleId)) || null;
  const otherApps = apps.filter((a) => !isChromeApp(a.bundleId));

  const otherPresence = otherApps.reduce((s, a) => s + (a.presenceSeconds || 0), 0);
  const otherActive = otherApps.reduce((s, a) => s + (a.activeSeconds || 0), 0);

  // Device totals from macOS (single foreground app at a time — no double-count with sites).
  const devicePresenceSeconds = desktopPayload.presenceSeconds ?? otherPresence + (chromeApp?.presenceSeconds || 0);
  const deviceActiveSeconds = desktopPayload.activeSeconds ?? otherActive + (chromeApp?.activeSeconds || 0);

  const desktopCategories = desktopPayload.categories?.length
    ? desktopPayload.categories
    : categorizeApps(otherApps);

  const mergedTimeline = mergeTimelines(chromeMetrics.timeline || [], desktopPayload.timeline || [], otherApps);

  return {
    available: true,
    devicePresenceSeconds,
    deviceActiveSeconds,
    otherApps: otherApps.sort((a, b) => b.presenceSeconds - a.presenceSeconds),
    chromeApp,
    otherPresenceSeconds: otherPresence,
    otherActiveSeconds: otherActive,
    categories: desktopCategories,
    mergedTimeline,
    syncedDevices: desktopPayload.syncedDevices || [],
    deviceId: desktopPayload.deviceId || null,
  };
}

function mergeTimelines(chromeTimeline, desktopTimeline, otherApps) {
  const byHour = new Map();

  for (const entry of chromeTimeline) {
    byHour.set(entry.hourStartTs, {
      hour: entry.hour,
      hourStartTs: entry.hourStartTs,
      chromeActivity: entry.activity || "",
      chromeTotal: entry.total || 0,
      chromeOpenSeconds: entry.openSeconds || 0,
      chromeDomains: entry.domains || [],
      apps: [],
      desktopTotal: 0,
    });
  }

  for (const entry of desktopTimeline) {
    const nonChromeApps = (entry.apps || []).filter((a) => !isChromeApp(a.bundleId));
    if (!nonChromeApps.length) continue;

    let row = byHour.get(entry.hourStartTs);
    if (!row) {
      row = {
        hour: entry.hour,
        hourStartTs: entry.hourStartTs,
        chromeActivity: "",
        chromeTotal: 0,
        chromeOpenSeconds: 0,
        chromeDomains: [],
        apps: [],
        desktopTotal: 0,
      };
      byHour.set(entry.hourStartTs, row);
    }
    row.apps = nonChromeApps;
    row.desktopTotal = nonChromeApps.reduce((s, a) => s + (a.seconds || 0), 0);
  }

  return [...byHour.values()]
    .sort((a, b) => a.hourStartTs - b.hourStartTs)
    .map((row) => {
      const parts = [];
      if (row.chromeActivity) parts.push(`Chrome: ${row.chromeActivity}`);
      if (row.apps.length) {
        const appText = row.apps
          .slice(0, 2)
          .map((a) => `${a.name} (${formatDuration(a.seconds)})`)
          .join(", ");
        parts.push(`Apps: ${appText}`);
      }
      const total = row.chromeTotal + row.desktopTotal;
      return {
        ...row,
        activity: parts.join(" · ") || "—",
        total,
        openSeconds: row.chromeOpenSeconds,
        domains: row.chromeDomains,
        isMerged: true,
      };
    })
    .filter((h) => h.total > 0 || h.openSeconds > 0);
}

export function buildDesktopSummaryForAI(desktopMerge) {
  if (!desktopMerge?.available) return "";

  const otherLines =
    desktopMerge.otherApps?.length > 0
      ? desktopMerge.otherApps
          .slice(0, 10)
          .map((a) => {
            const mins = Math.round((a.activeSeconds || a.presenceSeconds || 0) / 60);
            return `- ${a.name}: ${mins} min`;
          })
          .join("\n")
      : "- (no non-browser apps today)";

  const chromeAppLine = desktopMerge.chromeApp
    ? `\nChrome (as an app): ${Math.round((desktopMerge.chromeApp.activeSeconds || desktopMerge.chromeApp.presenceSeconds || 0) / 60)} min — site minutes below are separate detail.`
    : "";

  const categoryLine =
    desktopMerge.categories?.length > 0
      ? `\nDesktop app categories (non-browser): ${desktopMerge.categories
          .slice(0, 8)
          .map((c) => `${c.name} ${Math.round((c.seconds ?? c.minutes * 60) / 60)}m`)
          .join(", ")}`
      : "";

  return `\nYour day on this Mac (apps by time spent — do not quote dual clock totals in the narrative):
Other apps today:
${otherLines}${chromeAppLine}${categoryLine}
Do NOT add Chrome website minutes to Mac app totals above.`;
}

/** Compact hourly shape for AI narrative — timing insights, not clock jargon. */
export function buildTimelineSummaryForAI(timeline, { maxHours = 12 } = {}) {
  if (!timeline?.length) return "";

  const rows = timeline
    .filter((h) => (h.total || 0) >= 60 || (h.openSeconds || 0) >= 60)
    .sort((a, b) => a.hourStartTs - b.hourStartTs);

  if (!rows.length) return "";

  const limited =
    rows.length <= maxHours
      ? rows
      : [...rows]
          .sort((a, b) => (b.total || 0) - (a.total || 0))
          .slice(0, maxHours)
          .sort((a, b) => a.hourStartTs - b.hourStartTs);

  const lines = limited.map((h) => {
    const label = h.hour || new Date(h.hourStartTs).toLocaleTimeString([], { hour: "numeric" });
    const parts = [];
    for (const a of (h.apps || []).slice(0, 3)) {
      const m = Math.round((a.seconds || 0) / 60);
      if (m > 0 && a.name) parts.push(`${a.name} ${m}m`);
    }
    for (const d of (h.domains || h.chromeDomains || []).slice(0, 3)) {
      const name = d.domain || d;
      const m = Math.round((d.seconds || 0) / 60);
      if (name && m > 0) parts.push(`${name} ${m}m`);
    }
    const detail = parts.length ? parts.join(" · ") : h.activity || "—";
    return `${label} — ${detail}`;
  });

  return `\nRough hourly shape of the day (use for morning/afternoon timing — do not invent hours not listed):\n${lines.join("\n")}`;
}
