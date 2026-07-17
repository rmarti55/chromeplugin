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
  if (!desktopMerge?.available || !desktopMerge.otherApps?.length) return "";

  const lines = desktopMerge.otherApps
    .slice(0, 10)
    .map(
      (a) =>
        `- ${a.name}: ${Math.round((a.activeSeconds || 0) / 60)} min in use, ${Math.round((a.presenceSeconds || 0) / 60)} min in front`
    )
    .join("\n");

  const devicePresence = Math.round((desktopMerge.devicePresenceSeconds || 0) / 60);
  const deviceActive = Math.round((desktopMerge.deviceActiveSeconds || 0) / 60);

  return `\nDesktop apps (macOS companion — NOT site-level Chrome detail):
On your Mac: ${devicePresence} min in front, ${deviceActive} min in use across all apps.
Other apps today (exclude Chrome — site detail is above):
${lines}
Use desktop minutes for narrative breadth; Chrome site minutes remain authoritative for browsing.`;
}
