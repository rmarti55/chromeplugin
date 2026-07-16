// Service worker: durable, timestamp-based activity capture.
//
// Every state change (tab switch, url change, window focus, idle) is written
// immediately to IndexedDB as an event. Dwell time is derived from those events
// at read time (see db.js), so the worker being killed at any moment loses
// nothing. Periodic work uses chrome.alarms, never setInterval.

import { putEvent, pruneEventsBefore, getAnalysis } from "./db.js";
import { analyzeDay } from "./ai.js";

// Fire "idle" after this many seconds of no keyboard/mouse input. Tradeoff:
// chrome.idle cannot see media playback, so passively watching a long video or
// reading a long article with no input will be counted as idle and undercounted.
// A larger value counts more passive media but also more genuine away-from-desk
// time. 60s is a conservative default; revisit once dogfooding shows which way
// the error hurts more. (chrome.idle minimum is 15s.)
const IDLE_SECONDS = 60;
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
  // Only care when the active tab's url settles.
  if (!tab.active) return;
  if (!changeInfo.url && changeInfo.status !== "complete") return;
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
  // Anchor the current state so time starts accruing immediately.
  await logActiveTab("focus");
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  scheduleAlarms();
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

// Once past end-of-day, auto-generate today's narrative if a key is set and we
// haven't already analyzed today.
async function maybeAutoSummarize() {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) return;
  const hour = new Date().getHours();
  if (hour < 21) return; // only in the evening
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const already = await getAnalysis(dateStr);
  if (already) return;
  try {
    await analyzeDay(dateStr);
  } catch {
    // best-effort; the user can always summarize manually from the popup
  }
}

// --- Messages (from popup / dashboard) --------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_DAY") {
    analyzeDay(message.date)
      .then((analysis) => sendResponse({ ok: true, analysis }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async
  }
  if (message.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
