// Dashboard-side fetch for macOS companion data (proxied by background.js).

import { dmDebug, dmLog, dmRateLimited, dmWarn } from "../../log.js";

const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

const DESKTOP_TIMEOUT_MS = 2500;
const DESKTOP_LIVE_TIMEOUT_MS = 800;
const OFFLINE_WARN_INTERVAL_MS = 60_000;

function warnCompanionOffline(area, op, fields) {
  const key = `${area}.${op}`;
  const warned = dmRateLimited(key, OFFLINE_WARN_INTERVAL_MS, () => {
    dmWarn(area, op, fields);
  });
  if (!warned) {
    dmDebug(area, op, fields);
  }
}

/** @returns {{ payload: object|null, fetchOk: boolean }} */
export async function fetchDesktopDay(dateStr) {
  if (!hasChrome) return { payload: null, fetchOk: false };
  return new Promise((resolve) => {
    const start = performance.now();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      warnCompanionOffline("dashboard", "fetchDesktopDay.timeout", {
        date: dateStr,
        ms: Math.round(performance.now() - start),
      });
      resolve({ payload: null, fetchOk: false });
    }, DESKTOP_TIMEOUT_MS);

    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const ms = Math.round(performance.now() - start);
      if (chrome.runtime.lastError) {
        warnCompanionOffline("dashboard", "fetchDesktopDay.lastError", {
          date: dateStr,
          ms,
          err: chrome.runtime.lastError.message,
        });
        resolve({ payload: null, fetchOk: false });
        return;
      }
      if (!res?.ok) {
        warnCompanionOffline("dashboard", "fetchDesktopDay.fail", {
          date: dateStr,
          ms,
          err: res?.error || "unknown",
        });
        resolve({ payload: null, fetchOk: false });
        return;
      }
      dmLog("dashboard", "fetchDesktopDay.ok", {
        date: dateStr,
        ms,
        appCount: res.data?.apps?.length ?? 0,
      });
      resolve({ payload: res.data ?? null, fetchOk: true });
    });
  });
}

export async function fetchDesktopLive() {
  if (!hasChrome) return null;
  return new Promise((resolve) => {
    const start = performance.now();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      warnCompanionOffline("dashboard", "fetchDesktopLive.timeout", {
        ms: Math.round(performance.now() - start),
      });
      resolve(null);
    }, DESKTOP_LIVE_TIMEOUT_MS);

    chrome.runtime.sendMessage({ type: "GET_DESKTOP_LIVE" }, (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const ms = Math.round(performance.now() - start);
      if (chrome.runtime.lastError) {
        warnCompanionOffline("dashboard", "fetchDesktopLive.lastError", {
          ms,
          err: chrome.runtime.lastError.message,
        });
        resolve(null);
        return;
      }
      if (!res?.ok) {
        warnCompanionOffline("dashboard", "fetchDesktopLive.fail", {
          ms,
          err: res?.error || "unknown",
        });
        resolve(null);
        return;
      }
      resolve(res);
    });
  });
}
