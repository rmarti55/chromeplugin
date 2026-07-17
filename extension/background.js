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
import { dmLog, dmWarn, dmError, dmOnChange, dmRateLimited, errMsg } from "./log.js";

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
  if (!apiKey) {
    dmLog("sw", "autoSummarize.skip", { reason: "noApiKey" });
    return;
  }
  if (autoSummaryHourly === false) {
    dmLog("sw", "autoSummarize.skip", { reason: "disabled" });
    return;
  }

  const now = Date.now();
  const dateStr = toDateStr(now);
  const metrics = await getDayMetrics(dateStr, now);
  const { activeSeconds, openSeconds } = metrics;

  let desktopMerge = { available: false, devicePresenceSeconds: 0, deviceActiveSeconds: 0, otherApps: [] };
  try {
    const desktopRaw = await getDesktopDayMetrics(dateStr);
    desktopMerge = mergeDesktopWithChrome(metrics, desktopRaw);
  } catch (err) {
    dmWarn("sw", "autoSummarize.desktopOptional", { date: dateStr, err: errMsg(err) });
  }

  const devicePresence = desktopMerge.devicePresenceSeconds || 0;
  const deviceActive = desktopMerge.deviceActiveSeconds || 0;
  const desktopAppCount = (desktopMerge.otherApps?.length || 0) + (desktopMerge.chromeApp ? 1 : 0);

  if (
    activeSeconds < MIN_ACTIVITY_SECONDS &&
    openSeconds < MIN_ACTIVITY_SECONDS &&
    devicePresence < MIN_ACTIVITY_SECONDS
  ) {
    dmLog("sw", "autoSummarize.skip", {
      reason: "lowActivity",
      activeSeconds,
      openSeconds,
      devicePresence,
    });
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
    dmLog("sw", "autoSummarize.skip", { reason: "fingerprintMatch", date: dateStr });
    return;
  }

  try {
    dmLog("sw", "autoSummarize.run", { date: dateStr, desktopAppCount });
    await analyzeDay(dateStr);
    dmLog("sw", "autoSummarize.ok", { date: dateStr });
  } catch (err) {
    dmWarn("sw", "autoSummarize.fail", { date: dateStr, err: errMsg(err) });
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

function liveCacheSnapshot() {
  return {
    hostInstalled: desktopLiveCache.hostInstalled,
    hostReachable: desktopLiveCache.hostReachable,
    dataOk: desktopLiveCache.data?.ok ?? null,
    dataReason: desktopLiveCache.data?.reason ?? null,
    dataStatus: desktopLiveCache.data?.status ?? null,
    idleSeconds: desktopLiveCache.data?.idleSeconds ?? null,
    appName: desktopLiveCache.data?.appName ?? null,
  };
}

async function refreshDesktopLiveCache() {
  const start = performance.now();
  try {
    const data = await getDesktopLiveStatus();
    desktopHostKnown = true;
    desktopLiveCache = {
      fetchedAt: Date.now(),
      hostInstalled: true,
      hostReachable: true,
      data,
    };
    const ms = Math.round(performance.now() - start);
    dmOnChange("liveCache", liveCacheSnapshot(), (state) => {
      dmLog("sw", "liveCache.update", { ok: true, ms, ...state });
    });
    dmRateLimited("liveCache.ok", 30_000, () => {
      dmLog("sw", "liveCache.poll", { ok: true, ms, ...liveCacheSnapshot() });
    });
  } catch (err) {
    desktopLiveCache = {
      fetchedAt: Date.now(),
      hostInstalled: desktopHostKnown,
      hostReachable: false,
      data: desktopLiveCache.data,
    };
    const ms = Math.round(performance.now() - start);
    dmOnChange("liveCache", liveCacheSnapshot(), (state) => {
      dmError("sw", "liveCache.update", { ok: false, ms, err: errMsg(err), ...state });
    });
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
    dmLog("sw", "message.ANALYZE_DAY", {
      date: message.date,
      hasDesktopPayload: !!(message.desktopPayload?.apps?.length),
    });
    analyzeDay(message.date, { desktopPayload: message.desktopPayload ?? null })
      .then((analysis) => {
        dmLog("sw", "message.ANALYZE_DAY.ok", {
          date: message.date,
          includedDesktop: analysis.includedDesktop,
        });
        sendResponse({ ok: true, analysis });
      })
      .catch((err) => {
        dmError("sw", "message.ANALYZE_DAY.fail", { date: message.date, err: errMsg(err) });
        sendResponse({ ok: false, error: err.message });
      });
    return true; // async
  }
  if (message.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "GET_DESKTOP_DAY") {
    const start = performance.now();
    getDesktopDayMetrics(message.date)
      .then((data) => {
        markDesktopHostKnown();
        dmLog("sw", "message.GET_DESKTOP_DAY.ok", {
          date: message.date,
          ms: Math.round(performance.now() - start),
          appCount: data?.apps?.length ?? 0,
        });
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        dmError("sw", "message.GET_DESKTOP_DAY.fail", {
          date: message.date,
          ms: Math.round(performance.now() - start),
          err: errMsg(err),
        });
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  if (message.type === "GET_DESKTOP_LIVE") {
    const cacheAge = Date.now() - desktopLiveCache.fetchedAt;
    const stale = cacheAge > DESKTOP_LIVE_REFRESH_MS;
    if (stale) {
      refreshDesktopLiveCache()
        .then(() => {
          dmLog("sw", "message.GET_DESKTOP_LIVE", {
            refreshed: true,
            cacheAgeMs: cacheAge,
            ...liveCacheSnapshot(),
          });
          sendResponse({ ok: true, ...desktopLiveCache });
        })
        .catch((err) => {
          dmWarn("sw", "message.GET_DESKTOP_LIVE.stale", {
            refreshed: false,
            cacheAgeMs: cacheAge,
            err: errMsg(err),
            ...liveCacheSnapshot(),
          });
          sendResponse({ ok: true, ...desktopLiveCache });
        });
    } else {
      dmRateLimited("message.GET_DESKTOP_LIVE.cached", 10_000, () => {
        dmLog("sw", "message.GET_DESKTOP_LIVE", {
          refreshed: false,
          cacheAgeMs: cacheAge,
          ...liveCacheSnapshot(),
        });
      });
      sendResponse({ ok: true, ...desktopLiveCache });
    }
    return true;
  }
  return false;
});

startDesktopLivePolling();
