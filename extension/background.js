// Service worker: durable, timestamp-based activity capture.
//
// Every state change (tab switch, url change, window focus, idle) is written
// immediately to IndexedDB as an event. Dwell time is derived from those events
// at read time (see db.js), so the worker being killed at any moment loses
// nothing. Periodic work uses chrome.alarms, never setInterval.

import {
  putEvent,
  pruneEventsBefore,
  getAnalysis,
  getDayMetrics,
  getLastEventTsInDay,
  toDateStr,
  fingerprintsMatch,
} from "./db.js";
import { analyzeDay } from "./ai.js";
import { refreshHistoryCacheForDate } from "./history.js";
import { IDLE_SECONDS } from "./constants.js";
import { getDesktopDayMetrics, getDesktopLiveStatus } from "./desktop-bridge.js";
import { mergeDesktopWithChrome } from "./desktop-merge.js";

const MIN_ACTIVITY_SECONDS = 120; // 2 min before auto-summary runs
const RETENTION_DAYS = 120;

// Set at top level so idle detection is armed every time the worker wakes,
// not only on install/startup (the worker can respawn on any event).
chrome.idle.setDetectionInterval(IDLE_SECONDS);

// --- Event logging ----------------------------------------------------------

function webUrl(url) {
  return url && (url.startsWith("http://") || url.startsWith("https://"));
}

function eventFromTab(type, tab) {
  const ev = { ts: Date.now(), type, tabId: tab?.id ?? null };
  if (tab && webUrl(tab.url)) {
    let host = "";
    try {
      host = new URL(tab.url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    // Only record a web page we can attribute to a real host. Without one we
    // leave url unset so it reads as a non-web boundary (never a fake domain).
    if (host) {
      ev.url = tab.url;
      ev.title = tab.title || host;
      ev.domain = host;
    }
  }
  return ev;
}

async function logActiveTab(type, windowId) {
  try {
    const query = { active: true, lastFocusedWindow: true };
    if (typeof windowId === "number") {
      delete query.lastFocusedWindow;
      query.windowId = windowId;
    }
    const [tab] = await chrome.tabs.query(query);
    await putEvent(eventFromTab(type, tab || {}));
  } catch (e) {
    // If we can't resolve a tab, still record a boundary with no url.
    await putEvent({ ts: Date.now(), type, tabId: null });
  }
}

async function logStateChange(type) {
  await putEvent({ ts: Date.now(), type });
}

// --- Chrome event listeners -------------------------------------------------

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await putEvent(eventFromTab("activate", tab));
  } catch {
    await putEvent({ ts: Date.now(), type: "activate", tabId });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only record actual navigations (URL changes). Load "complete" without a URL
  // change is ignored — it was inflating visit counts on HMR, SPA reloads, etc.
  if (!tab.active) return;
  if (!changeInfo.url) return;
  // `tab.active` is also true for the active tab of a *background* window, so
  // confirm the tab's window is actually focused before we start counting it —
  // otherwise a background tab finishing a load would steal time.
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (!win.focused) return;
  } catch {
    return;
  }
  await putEvent(eventFromTab("urlchange", tab));
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await logStateChange("blur");
  } else {
    await logActiveTab("focus", windowId);
  }
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "active") {
    await logActiveTab("active");
  } else {
    // "idle" or "locked"
    await logStateChange(state);
  }
});

// --- Alarms -----------------------------------------------------------------

function scheduleAlarms() {
  chrome.alarms.create("nudge", { periodInMinutes: 120 });
  chrome.alarms.create("dailySummary", { periodInMinutes: 60 });
  chrome.alarms.create("prune", { periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  scheduleAlarms();
  startDesktopLivePolling();
  await refreshHistoryCacheForDate(toDateStr(Date.now())).catch(() => {});
  // Anchor the current state so time starts accruing immediately.
  await logActiveTab("focus");
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  scheduleAlarms();
  startDesktopLivePolling();
  await refreshHistoryCacheForDate(toDateStr(Date.now())).catch(() => {});
  await logActiveTab("focus");
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "prune") {
    await pruneEventsBefore(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return;
  }
  if (alarm.name === "nudge") {
    await maybeNudge();
    return;
  }
  if (alarm.name === "dailySummary") {
    await refreshHistoryCacheForDate(toDateStr(Date.now())).catch(() => {});
    await maybeAutoSummarize();
    return;
  }
});

// Passive check-in: during waking hours, if the user has set goals, show a
// small badge dot prompting them to glance at their day. Not naggy, not
// blocking — cleared when they open the popup.
async function maybeNudge() {
  const { goals } = await chrome.storage.local.get("goals");
  if (!goals || !goals.trim()) return;
  const hour = new Date().getHours();
  if (hour < 9 || hour >= 21) return;
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  chrome.action.setBadgeText({ text: "•" });
}

// Hourly auto-summary: refresh today's narrative when new activity has accrued.
// Skips API calls when idle (fingerprint unchanged) or below MIN_ACTIVITY_SECONDS.
async function maybeAutoSummarize() {
  const { apiKey, autoSummaryHourly } = await chrome.storage.local.get([
    "apiKey",
    "autoSummaryHourly",
  ]);
  if (!apiKey) return;
  if (autoSummaryHourly === false) return;

  const now = Date.now();
  const dateStr = toDateStr(now);
  const metrics = await getDayMetrics(dateStr, now);
  const { activeSeconds, openSeconds } = metrics;

  let desktopMerge = { available: false, devicePresenceSeconds: 0, deviceActiveSeconds: 0, otherApps: [] };
  try {
    const desktopRaw = await getDesktopDayMetrics(dateStr);
    desktopMerge = mergeDesktopWithChrome(metrics, desktopRaw);
  } catch {
    /* companion optional for auto-summarize */
  }

  const devicePresence = desktopMerge.devicePresenceSeconds || 0;
  const deviceActive = desktopMerge.deviceActiveSeconds || 0;
  const desktopAppCount = (desktopMerge.otherApps?.length || 0) + (desktopMerge.chromeApp ? 1 : 0);

  if (
    activeSeconds < MIN_ACTIVITY_SECONDS &&
    openSeconds < MIN_ACTIVITY_SECONDS &&
    devicePresence < MIN_ACTIVITY_SECONDS
  ) {
    return;
  }

  const lastEventTs = await getLastEventTsInDay(dateStr, now);
  const current = {
    activeSeconds,
    openSeconds,
    lastEventTs,
    devicePresenceSeconds: devicePresence,
    deviceActiveSeconds: deviceActive,
    desktopAppCount,
  };

  const existing = await getAnalysis(dateStr);
  if (existing?.activityFingerprint && fingerprintsMatch(existing.activityFingerprint, current)) {
    return;
  }

  try {
    await analyzeDay(dateStr);
  } catch {
    // best-effort; the user can always summarize manually from the popup
  }
}

// --- Desktop live status cache (Mac companion heartbeat) --------------------

const DESKTOP_LIVE_REFRESH_MS = 2000;

let desktopHostKnown = false;

let desktopLiveCache = {
  fetchedAt: 0,
  hostInstalled: false,
  hostReachable: false,
  data: null,
};

async function refreshDesktopLiveCache() {
  try {
    const data = await getDesktopLiveStatus();
    desktopHostKnown = true;
    desktopLiveCache = {
      fetchedAt: Date.now(),
      hostInstalled: true,
      hostReachable: true,
      data,
    };
  } catch {
    desktopLiveCache = {
      fetchedAt: Date.now(),
      hostInstalled: desktopHostKnown,
      hostReachable: false,
      data: desktopLiveCache.data,
    };
  }
}

function markDesktopHostKnown() {
  desktopHostKnown = true;
  if (!desktopLiveCache.hostInstalled) {
    desktopLiveCache = { ...desktopLiveCache, hostInstalled: true };
  }
}

function startDesktopLivePolling() {
  refreshDesktopLiveCache().catch(() => {});
  if (startDesktopLivePolling.started) return;
  startDesktopLivePolling.started = true;
  setInterval(() => refreshDesktopLiveCache().catch(() => {}), DESKTOP_LIVE_REFRESH_MS);
}
startDesktopLivePolling.started = false;

// --- Messages (from popup / dashboard) --------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_DAY") {
    analyzeDay(message.date, { desktopPayload: message.desktopPayload ?? null })
      .then((analysis) => sendResponse({ ok: true, analysis }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async
  }
  if (message.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "GET_DESKTOP_DAY") {
    getDesktopDayMetrics(message.date)
      .then((data) => {
        markDesktopHostKnown();
        sendResponse({ ok: true, data });
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === "GET_DESKTOP_LIVE") {
    if (Date.now() - desktopLiveCache.fetchedAt > DESKTOP_LIVE_REFRESH_MS) {
      refreshDesktopLiveCache()
        .then(() => sendResponse({ ok: true, ...desktopLiveCache }))
        .catch(() => sendResponse({ ok: true, ...desktopLiveCache }));
    } else {
      sendResponse({ ok: true, ...desktopLiveCache });
    }
    return true;
  }
  return false;
});

startDesktopLivePolling();
