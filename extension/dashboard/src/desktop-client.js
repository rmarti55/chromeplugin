// Dashboard-side fetch for macOS companion data (proxied by background.js).

import { dmLog, dmWarn } from "../../log.js";

const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

const DESKTOP_TIMEOUT_MS = 2500;

export async function fetchDesktopDay(dateStr) {
  if (!hasChrome) return null;
  return new Promise((resolve) => {
    const start = performance.now();
    const timer = setTimeout(() => {
      dmWarn("dashboard", "fetchDesktopDay.timeout", {
        date: dateStr,
        ms: Math.round(performance.now() - start),
      });
      resolve(null);
    }, DESKTOP_TIMEOUT_MS);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - start);
      if (chrome.runtime.lastError) {
        dmWarn("dashboard", "fetchDesktopDay.lastError", {
          date: dateStr,
          ms,
          err: chrome.runtime.lastError.message,
        });
        resolve(null);
        return;
      }
      if (!res?.ok) {
        dmWarn("dashboard", "fetchDesktopDay.fail", {
          date: dateStr,
          ms,
          err: res?.error || "unknown",
        });
        resolve(null);
        return;
      }
      dmLog("dashboard", "fetchDesktopDay.ok", {
        date: dateStr,
        ms,
        appCount: res.data?.apps?.length ?? 0,
      });
      resolve(res.data);
    });
  });
}

export async function fetchDesktopLive() {
  if (!hasChrome) return null;
  return new Promise((resolve) => {
    const start = performance.now();
    const timer = setTimeout(() => {
      dmWarn("dashboard", "fetchDesktopLive.timeout", {
        ms: Math.round(performance.now() - start),
      });
      resolve(null);
    }, 800);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_LIVE" }, (res) => {
      clearTimeout(timer);
      const ms = Math.round(performance.now() - start);
      if (chrome.runtime.lastError) {
        dmWarn("dashboard", "fetchDesktopLive.lastError", {
          ms,
          err: chrome.runtime.lastError.message,
        });
        resolve(null);
        return;
      }
      if (!res?.ok) {
        dmWarn("dashboard", "fetchDesktopLive.fail", { ms, err: res?.error || "unknown" });
        resolve(null);
        return;
      }
      resolve(res);
    });
  });
}
