// User-facing labels — single source of truth for dashboard, popup, live status, AI prompts.
// Internal code keeps openSeconds / activeSeconds / presenceSeconds.

import { formatDuration } from "./db.js";

export const LABELS = {
  inChrome: "In Chrome",
  usingChrome: "Using Chrome",
  onMac: "On your Mac",
  usingMac: "Using your Mac",
  inFront: "In front",
  inUse: "In use",
  otherApps: "Other apps",
  chromeHistory: "Chrome History",
  visits: "visits",

  // Live status (chrome.idle API: active | idle | locked)
  idle: "In Chrome · idle",
  macIdle: "On your Mac · idle",
  macIdleWithApp: (app) => `On your Mac · idle (${app})`,
  locked: "Screen locked",
  inBackground: "Chrome in background",
  usingChromeOn: "Using Chrome ·",
  usingMacOn: "Using your Mac ·",
  macOffline: "Desktop app isn't running — open Daily Mirror from the menu bar",
  macHostBroken: "Mac companion isn't working — reinstall the native host",
  macLive: "Mac live",
  todayOnMac: "Today",
  macOfflineBanner: "Desktop app isn't running. Open Daily Mirror from the menu bar to resume live Mac tracking.",
  macOfflineLaunchCmd: "open macos/DailyMirrorCompanion.app",

  // Unified day story
  browsingChapter: "Browsing",
  otherAppsToday: "Other apps today",
  dayByHour: "Your day by hour",
  dayByCategory: "Your day by category",

  // Tooltips
  tipInChrome: "Chrome was the app on screen.",
  tipUsingChrome: "You were using the keyboard or mouse in Chrome.",
  tipOnMac: "Any app was on screen (one at a time).",
  tipUsingMac: "You were using the keyboard or mouse on your Mac.",
  tipBrowsingChapter: "Website detail when Chrome was in front — not added to Mac totals.",
  tipOtherApps: "Non-browser apps that were in front today.",
};

export function appTimeLabel(presenceSeconds, activeSeconds) {
  const front = formatDuration(presenceSeconds);
  if (activeSeconds >= presenceSeconds || activeSeconds === 0) return front;
  return `${front} in front · ${formatDuration(activeSeconds)} in use`;
}
