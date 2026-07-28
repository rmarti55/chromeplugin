// Calendar period helpers — window + grain for week/month breakdown charts.
// Week = calendar Mon–Sun containing the anchor date; month = calendar month.

import { getDayMetrics, toDateStr, classifyDay } from "./db.js";
import { mergeDesktopWithChrome } from "./desktop-merge.js";
import { LABELS } from "./labels.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, delta) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d.getTime());
}

function formatShortDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** Mon–Sun calendar week containing anchorDateStr. */
export function getCalendarWeekDays(anchorDateStr) {
  const d = parseLocalDate(anchorDateStr);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = parseLocalDate(anchorDateStr);
  monday.setDate(d.getDate() + mondayOffset);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push(toDateStr(cur.getTime()));
  }
  return days;
}

export function getWeekRangeLabel(days) {
  if (!days?.length) return "";
  const start = parseLocalDate(days[0]);
  const end = parseLocalDate(days[days.length - 1]);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}`;
  }
  return `${formatShortDate(days[0])} – ${formatShortDate(days[days.length - 1])}`;
}

export function shiftAnchorByDays(dateStr, delta) {
  return addDays(dateStr, delta);
}

export function shiftAnchorByWeeks(dateStr, delta) {
  return addDays(dateStr, delta * 7);
}

export function shiftAnchorByMonth(dateStr, delta) {
  const d = parseLocalDate(dateStr);
  d.setMonth(d.getMonth() + delta);
  return toDateStr(d.getTime());
}

export function weekContainsToday(anchorDateStr, now = Date.now()) {
  const today = toDateStr(now);
  return getCalendarWeekDays(anchorDateStr).includes(today);
}

export function monthContainsToday(anchorDateStr, now = Date.now()) {
  const anchor = parseLocalDate(anchorDateStr);
  const today = parseLocalDate(toDateStr(now));
  return anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
}

/** Calendar weeks overlapping the anchor's month (Mon–Sun buckets, days clipped to month). */
export function getMonthWeekBuckets(anchorDateStr) {
  const anchor = parseLocalDate(anchorDateStr);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const monthStartStr = toDateStr(monthStart.getTime());
  const monthEndStr = toDateStr(monthEnd.getTime());

  const buckets = [];
  let cursor = new Date(monthStart);
  const dow = cursor.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  cursor.setDate(cursor.getDate() + mondayOffset);

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      if (d >= monthStart && d <= monthEnd) {
        days.push(toDateStr(d.getTime()));
      }
    }
    if (days.length > 0) {
      const startDate = days[0];
      const endDate = days[days.length - 1];
      buckets.push({
        key: `${startDate}_${endDate}`,
        label:
          startDate === endDate
            ? formatShortDate(startDate)
            : `${parseLocalDate(startDate).getDate()}–${parseLocalDate(endDate).getDate()}`,
        startDate,
        endDate,
        days,
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    year,
    month,
    monthLabel: `${MONTH_NAMES[month]} ${year}`,
    monthStart: monthStartStr,
    monthEnd: monthEndStr,
    buckets,
  };
}

export function formatDayBarLabel(dateStr, todayStr) {
  const d = parseLocalDate(dateStr);
  if (dateStr === todayStr) return "Today";
  return DAY_NAMES[d.getDay()];
}

/** Primary bar metric — prefer Mac active when present, else best of Mac/Chrome. */
export function primarySecondsFromDay(chromeMetrics, desktopMerged) {
  const chromeActive = chromeMetrics.activeSeconds || 0;
  const chromeOpen = chromeMetrics.openSeconds || 0;
  const macActive = desktopMerged?.deviceActiveSeconds || 0;
  const macOpen = desktopMerged?.devicePresenceSeconds || 0;

  if (desktopMerged?.available && macActive > 0) {
    return { activeSeconds: macActive, openSeconds: macOpen, source: "mac" };
  }

  const activeSeconds = Math.max(chromeActive, macActive);
  const openSeconds = Math.max(chromeOpen, macOpen);
  return {
    activeSeconds,
    openSeconds,
    source: macActive > chromeActive ? "mac" : "chrome",
  };
}

export async function loadDayRollup(dateStr, now, fetchDesktopDay) {
  const emptyDesktop = { payload: null, fetchOk: false };
  const today = toDateStr(now);
  const metrics = await getDayMetrics(dateStr, now);

  let desktopResult = emptyDesktop;
  if (fetchDesktopDay && dateStr <= today) {
    desktopResult = await fetchDesktopDay(dateStr);
  }

  const desktopRaw = desktopResult?.payload ?? null;
  const desktopFetchOk = desktopResult?.fetchOk ?? false;
  const desktop = mergeDesktopWithChrome(metrics, desktopRaw);
  const { activeSeconds, openSeconds, source } = primarySecondsFromDay(metrics, desktop);
  const status = classifyDay({
    sessions: metrics.sessions,
    openSeconds: metrics.openSeconds,
    activeSeconds: metrics.activeSeconds,
    desktopAvailable: desktop.available,
    desktopFetchOk,
  });
  const hasActivity = status === "active";

  return {
    date: dateStr,
    activeSeconds,
    openSeconds,
    source,
    hasActivity,
    status,
    desktopAvailable: desktop.available,
    desktopFetchOk,
  };
}

async function loadDayRollupsSequential(dates, now, fetchDesktopDay) {
  const rollups = [];
  for (const d of dates) {
    rollups.push(await loadDayRollup(d, now, fetchDesktopDay));
  }
  return rollups;
}

/** Week breakdown: window = calendar week, grain = day. */
export async function getWeekBreakdown(anchorDateStr, { now = Date.now(), fetchDesktopDay } = {}) {
  const days = getCalendarWeekDays(anchorDateStr);
  const today = toDateStr(now);
  const rollups = await loadDayRollupsSequential(days, now, fetchDesktopDay);

  const bars = rollups.map((r) => ({
    key: r.date,
    date: r.date,
    label: formatDayBarLabel(r.date, today),
    seconds: r.activeSeconds,
    openSeconds: r.openSeconds,
    hasActivity: r.hasActivity,
    status: r.status,
    source: r.source,
  }));

  const totalActive = bars.reduce((s, b) => s + b.seconds, 0);
  const quietDayCount = rollups.filter((r) => !r.hasActivity).length;
  const anyMac = rollups.some((r) => r.desktopAvailable);
  const metricLabel = anyMac ? LABELS.activeMac : LABELS.activeChrome;

  return {
    kind: "week",
    title: LABELS.daysOfWeek,
    subtitle: getWeekRangeLabel(days),
    days,
    bars,
    totalActive,
    quietDayCount,
    metricLabel,
    anyMac,
  };
}

/** Month breakdown: window = calendar month, grain = week. */
export async function getMonthBreakdown(anchorDateStr, { now = Date.now(), fetchDesktopDay } = {}) {
  const { monthLabel, buckets } = getMonthWeekBuckets(anchorDateStr);
  const allDays = [...new Set(buckets.flatMap((b) => b.days))];
  const rollups = await loadDayRollupsSequential(allDays, now, fetchDesktopDay);
  const byDate = new Map(rollups.map((r) => [r.date, r]));

  const bars = buckets.map((bucket) => {
    const days = bucket.days.map((d) => byDate.get(d)).filter(Boolean);
    const activeSeconds = days.reduce((s, d) => s + d.activeSeconds, 0);
    const openSeconds = days.reduce((s, d) => s + d.openSeconds, 0);
    const hasActivity = days.some((d) => d.hasActivity);
    const quietDayCount = days.filter((d) => !d.hasActivity).length;
    const activeDayCount = days.filter((d) => d.hasActivity).length;
    const anyMac = days.some((d) => d.desktopAvailable);

    return {
      key: bucket.key,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      days: bucket.days,
      seconds: activeSeconds,
      openSeconds,
      hasActivity,
      quietDayCount,
      activeDayCount,
      source: anyMac ? "mac" : "chrome",
    };
  });

  const totalActive = bars.reduce((s, b) => s + b.seconds, 0);
  const quietDayCount = rollups.filter((r) => !r.hasActivity).length;
  const anyMac = rollups.some((r) => r.desktopAvailable);
  const metricLabel = anyMac ? LABELS.activeMac : LABELS.activeChrome;

  return {
    kind: "month",
    title: LABELS.weeksOfMonth,
    subtitle: monthLabel,
    bars,
    totalActive,
    quietDayCount,
    metricLabel,
    anyMac,
  };
}
