// Live status for the popup and dashboard.
//
// Mac-first when the companion heartbeat is fresh (GET_DESKTOP_LIVE).
// Red offline when Mac day data exists but capture is down.
// Falls back to Chrome-only when the native host was never set up.

import { getCurrentActivity } from "./db.js";
import { IDLE_SECONDS } from "./constants.js";
import { LABELS } from "./labels.js";
import { isChromeApp } from "./desktop-bridge.js";

const LIVE_FETCH_TIMEOUT_MS = 2000;

function host(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
const isWeb = (u) => !!u && /^https?:\/\//.test(u);

function macOffline(message) {
  return {
    status: "offline",
    message,
    macHostInstalled: true,
    macLiveFresh: false,
  };
}

async function fetchDesktopLiveFromBackground() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return null;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), LIVE_FETCH_TIMEOUT_MS);
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

function liveFromMacPayload(macLive, chromeLive) {
  const macMeta = {
    macHostInstalled: true,
    macLiveFresh: true,
  };
  const { status, bundleId, appName } = macLive;

  if (status === "locked") {
    return { status: "paused", reason: "locked", message: LABELS.locked, ...macMeta };
  }
  if (status === "idle") {
    return { status: "idle", reason: "idle", message: LABELS.macIdle, ...macMeta };
  }

  if (isChromeApp(bundleId)) {
    if (chromeLive.domain) {
      return {
        status: "capturing",
        domain: chromeLive.domain,
        message: LABELS.usingChrome,
        macAppName: appName || "Chrome",
        ...macMeta,
      };
    }
    return { status: "capturing", message: LABELS.inChrome, macAppName: appName || "Chrome", ...macMeta };
  }

  return {
    status: "capturing",
    appName: appName || bundleId || "",
    message: LABELS.usingMacOn,
    ...macMeta,
  };
}

export async function getLiveStatus(now = Date.now(), { macDayAvailable = false } = {}) {
  const chromeLive = await getChromeLiveStatus(now);
  const macEnvelope = await fetchDesktopLiveFromBackground();

  const hostKnown = !!(macEnvelope?.hostInstalled || macDayAvailable);

  if (!hostKnown) {
    return { ...chromeLive, macHostInstalled: false, macLiveFresh: false };
  }

  if (!macEnvelope) {
    return macOffline(LABELS.macHostBroken);
  }

  if (!macEnvelope.hostReachable) {
    return macOffline(LABELS.macHostBroken);
  }

  const macLive = macEnvelope.data;

  if (!macLive?.ok) {
    return macOffline(LABELS.macOffline);
  }

  return liveFromMacPayload(macLive, chromeLive);
}

/** Shared dot color classes for dashboard live indicators. */
export function liveDotClass(status) {
  if (status === "offline") return "bg-red-500";
  if (status === "paused") return "bg-amber-500";
  if (status === "idle") return "bg-sky-500";
  return "bg-green-500";
}

export function livePingClass(status) {
  if (status === "idle") return "bg-sky-500";
  return "bg-green-500";
}

export function liveStatusText(live) {
  if (!live) return "";
  if (live.status === "offline" || live.status === "paused" || live.status === "idle") {
    return live.message || LABELS.inBackground;
  }
  if (live.domain) return `${LABELS.usingChromeOn} ${live.domain}`;
  if (live.appName) return `${LABELS.usingMacOn} ${live.appName}`;
  return live.message || LABELS.inChrome;
}

export function showMacLiveRow(live, macDayAvailable) {
  return !!(live?.macHostInstalled || macDayAvailable);
}
