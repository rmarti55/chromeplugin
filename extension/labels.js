// User-facing labels — single source of truth for dashboard, popup, live status, AI prompts.
// Internal code keeps openSeconds / activeSeconds / presenceSeconds.
//
// Future: phone tracking would extend "fully unplugged" beyond Mac+Chrome.
// Unplug encouragement (streaks, goals) can build on quiet-day counts once baseline UX ships.

import { formatDisplayDate, formatDuration, toDateStr } from "./db.js";

export const LABELS = {
  // Universal clock pair (captions under section headers)
  passive: "Passive",
  active: "Active",

  // Scoped clock labels (when context must be inline)
  passiveChrome: "Passive in Chrome",
  activeChrome: "Active in Chrome",
  passiveMac: "Passive on Mac",
  activeMac: "Active on Mac",

  // Legacy keys — same values, kept for call-site compatibility
  inChrome: "Passive in Chrome",
  usingChrome: "Active in Chrome",
  onMac: "Passive on Mac",
  usingMac: "Active on Mac",
  inFront: "Passive",
  inUse: "Active",

  otherApps: "Other apps",
  chromeHistory: "Chrome History",
  visits: "visits",

  // Live status (chrome.idle API: active | idle | locked)
  idle: "Chrome · idle",
  macIdle: "Mac · idle",
  macIdleWithApp: (app) => `Mac · idle (${app})`,
  locked: "Screen locked",
  inBackground: "Chrome in background",
  liveActiveOn: "Active ·",
  chromeOpen: "Chrome open",
  // Legacy live keys
  usingChromeOn: "Active ·",
  usingMacOn: "Active ·",

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

  // Period breakdown views (window + grain)
  viewDay: "Day",
  viewWeek: "Week",
  viewMonth: "Month",
  daysOfWeek: "Days of this week",
  weeksOfMonth: "Weeks of this month",

  // Tooltips
  tipPassive: "On screen but no recent keyboard or mouse input.",
  tipActive: "On screen with recent keyboard or mouse input.",
  tipPassiveChrome: "Chrome was on screen but you weren't clicking or typing.",
  tipActiveChrome: "You were clicking or typing in Chrome.",
  tipPassiveMac: "An app was on screen but you weren't clicking or typing.",
  tipActiveMac: "You were clicking or typing on your Mac.",
  tipBrowsingChapter: "Browser detail — not added to Mac totals.",
  tipOtherApps: "Non-browser apps that were on screen today.",
  // Legacy tip keys
  tipInChrome: "Chrome was on screen but you weren't clicking or typing.",
  tipUsingChrome: "You were clicking or typing in Chrome.",
  tipOnMac: "An app was on screen but you weren't clicking or typing.",
  tipUsingMac: "You were clicking or typing on your Mac.",

  // Quiet days (no Chrome + no Mac tracked)
  quietDayToday: "So far today, nothing has been tracked in Chrome or on your Mac.",
  quietDayYesterday: "A quiet day — nothing tracked in Chrome or on your Mac.",
  quietDayUnconfirmed:
    "No activity recorded. If you were away from your screens, that's worth noting. If you were active, make sure Daily Mirror is running in the menu bar.",
  quietDayNote: "Days with no tracked screen time are part of the picture too.",
  quietDayTooltip: "Quiet day — no tracked activity",
};

export function clockPairCaption() {
  return `${LABELS.passive} · ${LABELS.active}`;
}

export function appTimeLabel(presenceSeconds, activeSeconds) {
  const passive = formatDuration(presenceSeconds);
  if (activeSeconds >= presenceSeconds || activeSeconds === 0) return passive;
  return `${passive} ${LABELS.passive.toLowerCase()} · ${formatDuration(activeSeconds)} ${LABELS.active.toLowerCase()}`;
}

export function quietDayPastLabel(dateStr) {
  return `A quiet day (${formatDisplayDate(dateStr)}) — nothing tracked in Chrome or on your Mac.`;
}

/** Primary summary line for a non-active day. */
export function quietDaySummary(dateStr, status, now = Date.now()) {
  if (status === "unconfirmed") return LABELS.quietDayUnconfirmed;
  const today = toDateStr(now);
  const dateMs = new Date(dateStr + "T00:00:00").getTime();
  const todayMs = new Date(today + "T00:00:00").getTime();
  const offsetDays = Math.round((todayMs - dateMs) / 86400000);
  if (offsetDays === 0) return LABELS.quietDayToday;
  if (offsetDays === 1) return LABELS.quietDayYesterday;
  return quietDayPastLabel(dateStr);
}

export function quietDaysCountLabel(count, periodKind) {
  const noun = count === 1 ? "quiet day" : "quiet days";
  if (periodKind === "week") return `${count} ${noun} this week`;
  if (periodKind === "month") return `${count} ${noun} this month`;
  return `${count} ${noun}`;
}

export function quietWeekBarDetail(activeDayCount, quietDayCount) {
  const parts = [];
  if (activeDayCount > 0) parts.push(`${activeDayCount} active`);
  if (quietDayCount > 0) parts.push(`${quietDayCount} quiet`);
  return parts.join(", ");
}
