// Live status for the popup and dashboard.
//
// Returns independent Chrome and Mac live rows — Chrome is never replaced by Mac.

import { getCurrentActivity } from "./db.js";
import { IDLE_SECONDS } from "./constants.js";
import { LABELS } from "./labels.js";
import { isChromeApp } from "./desktop-bridge.js";
import { dmLog, dmWarn, dmOnChange, dmRateLimited } from "./log.js";

const LIVE_FETCH_TIMEOUT_MS = 2000;

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
    const timer = setTimeout(() => {
      dmWarn("live", "fetchDesktopLive.timeout", { ms: LIVE_FETCH_TIMEOUT_MS });
      resolve(null);
    }, LIVE_FETCH_TIMEOUT_MS);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_LIVE" }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        dmWarn("live", "fetchDesktopLive.lastError", { err: chrome.runtime.lastError.message });
        resolve(null);
        return;
      }
      if (!res?.ok) {
        dmWarn("live", "fetchDesktopLive.badResponse", { ok: res?.ok });
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

function macOfflineStatus(message) {
  return {
    status: "offline",
    message,
    macLiveFresh: false,
  };
}

function macIdleMessage(appName) {
  if (appName) return LABELS.macIdleWithApp(appName);
  return LABELS.macIdle;
}

function macFromPayload(macLive) {
  const { status, bundleId, appName } = macLive;

  if (status === "locked") {
    return { status: "paused", reason: "locked", message: LABELS.locked, macLiveFresh: true };
  }
  if (status === "idle") {
    return {
      status: "idle",
      reason: "idle",
      message: macIdleMessage(appName),
      appName: appName || undefined,
      macLiveFresh: true,
    };
  }

  if (isChromeApp(bundleId)) {
    return {
      status: "capturing",
      appName: appName || "Chrome",
      message: LABELS.inChrome,
      macLiveFresh: true,
    };
  }

  return {
    status: "capturing",
    appName: appName || bundleId || "",
    message: LABELS.usingMacOn,
    macLiveFresh: true,
  };
}

async function getMacLiveStatus(macDayAvailable) {
  const macEnvelope = await fetchDesktopLiveFromBackground();
  const hostKnown = !!(macEnvelope?.hostInstalled || macDayAvailable);

  if (!hostKnown) {
    dmOnChange("macLive.branch", { branch: "hidden" }, (state) => {
      dmWarn("live", "macLive.branch", state);
    });
    return null;
  }

  if (!macEnvelope) {
    dmOnChange("macLive.branch", { branch: "hostBroken", reason: "envelopeNull" }, (state) => {
      dmWarn("live", "macLive.branch", state);
    });
    return macOfflineStatus(LABELS.macHostBroken);
  }

  if (!macEnvelope.hostReachable) {
    dmOnChange("macLive.branch", { branch: "hostBroken", reason: "notReachable" }, (state) => {
      dmWarn("live", "macLive.branch", state);
    });
    return macOfflineStatus(LABELS.macHostBroken);
  }

  const macLive = macEnvelope.data;

  if (!macLive?.ok) {
    dmOnChange(
      "macLive.branch",
      { branch: "appOffline", reason: macLive?.reason || "missing" },
      (state) => {
        dmWarn("live", "macLive.branch", state);
      }
    );
    return macOfflineStatus(LABELS.macOffline);
  }

  dmOnChange(
    "macLive.branch",
    { branch: "live", status: macLive.status, appName: macLive.appName },
    (state) => {
      dmLog("live", "macLive.branch", state);
    }
  );

  if (macLive.status === "idle") {
    dmRateLimited("macLive.idle", 15_000, () => {
      dmWarn("live", "macLive.idle", {
        status: macLive.status,
        appName: macLive.appName,
        idleSeconds: macLive.idleSeconds,
        ts: macLive.ts,
      });
    });
  } else if (macLive.status === "capturing") {
    dmRateLimited("macLive.capturing", 30_000, () => {
      dmLog("live", "macLive.capturing", {
        status: macLive.status,
        appName: macLive.appName,
        idleSeconds: macLive.idleSeconds,
        ts: macLive.ts,
      });
    });
  }

  return macFromPayload(macLive);
}

export async function getLiveStatus(now = Date.now(), { macDayAvailable = false } = {}) {
  const [chrome, mac] = await Promise.all([
    getChromeLiveStatus(now),
    getMacLiveStatus(macDayAvailable),
  ]);
  return { chrome, mac };
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

export function chromeLiveStatusText(chrome) {
  if (!chrome) return "";
  if (chrome.status === "offline" || chrome.status === "paused" || chrome.status === "idle") {
    return chrome.message || LABELS.inBackground;
  }
  if (chrome.domain) return `${LABELS.usingChromeOn} ${chrome.domain}`;
  return chrome.message || LABELS.inChrome;
}

export function macLiveStatusText(mac) {
  if (!mac) return "";
  if (mac.status === "offline" || mac.status === "paused" || mac.status === "idle") {
    return mac.message || LABELS.macOffline;
  }
  if (mac.appName) return `${LABELS.usingMacOn} ${mac.appName}`;
  return mac.message || LABELS.inChrome;
}

/** @deprecated use chromeLiveStatusText / macLiveStatusText */
export function liveStatusText(live) {
  if (live?.chrome) return chromeLiveStatusText(live.chrome);
  return chromeLiveStatusText(live);
}

export function showMacLiveRow(mac) {
  return mac != null;
}

export function liveRowTextColor(status) {
  if (status === "offline") return "text-red-300";
  return "text-slate-300";
}

export function popupDotClass(status) {
  if (status === "offline") return "dot offline";
  if (status === "paused") return "dot paused";
  if (status === "idle") return "dot idle";
  return "dot capturing";
}
