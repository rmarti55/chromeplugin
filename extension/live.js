// Live status for the popup and dashboard.
//
// Mac-first when the companion heartbeat is fresh (GET_DESKTOP_LIVE).
// Falls back to Chrome focus + idle when the native host is unavailable.

import { getCurrentActivity } from "./db.js";
import { IDLE_SECONDS } from "./constants.js";
import { LABELS } from "./labels.js";
import { isChromeApp } from "./desktop-bridge.js";

function host(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
const isWeb = (u) => !!u && /^https?:\/\//.test(u);

async function fetchDesktopLiveFromBackground() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return null;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 800);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_LIVE" }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError || !res?.ok) {
        resolve(null);
        return;
      }
      resolve(res);
    });
  });
}

async function getChromeLiveStatus(now = Date.now()) {
  const hasChrome = typeof chrome !== "undefined" && chrome.tabs && chrome.idle;
  if (!hasChrome) {
    return getCurrentActivity(now);
  }

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  } catch {
    /* no tab */
  }

  if (!tab) {
    return { status: "paused", reason: "away", message: LABELS.inBackground };
  }

  let idleState = "active";
  try {
    idleState = await chrome.idle.queryState(IDLE_SECONDS);
  } catch {
    /* keep default */
  }

  if (idleState === "locked") {
    return { status: "paused", reason: "locked", message: LABELS.locked };
  }
  if (idleState !== "active") {
    return { status: "idle", reason: "idle", message: LABELS.idle };
  }

  if (tab && isWeb(tab.url)) {
    return { status: "capturing", domain: host(tab.url), message: LABELS.usingChrome };
  }
  return { status: "capturing", message: LABELS.inChrome };
}

export async function getLiveStatus(now = Date.now()) {
  const chromeLive = await getChromeLiveStatus(now);
  const macEnvelope = await fetchDesktopLiveFromBackground();

  // Native host not installed or unreachable — Chrome-only live status.
  if (!macEnvelope?.hostInstalled) {
    return chromeLive;
  }

  const macLive = macEnvelope.data;

  // Host responds but menu bar tracker is not writing a fresh heartbeat.
  if (!macLive?.ok) {
    return {
      status: "paused",
      reason: macLive?.reason || "stale",
      message: LABELS.macNotCapturing,
    };
  }

  const { status, bundleId, appName } = macLive;

  if (status === "locked") {
    return { status: "paused", reason: "locked", message: LABELS.locked };
  }
  if (status === "idle") {
    return { status: "idle", reason: "idle", message: LABELS.macIdle };
  }

  // Mac capturing — prefer Chrome site detail when Chrome is frontmost.
  if (isChromeApp(bundleId)) {
    if (chromeLive.domain) {
      return {
        status: "capturing",
        domain: chromeLive.domain,
        message: LABELS.usingChrome,
      };
    }
    return { status: "capturing", message: LABELS.inChrome };
  }

  return {
    status: "capturing",
    appName: appName || bundleId || "",
    message: LABELS.usingMacOn,
  };
}
