// Chrome ↔ macOS companion bridge via native messaging.
// Requires install: macos/Scripts/install-native-host.sh

import { dmLog, dmWarn, dmError, errMsg } from "./log.js";

const NATIVE_HOST = "com.dailymirror.companion";

export const CHROME_BUNDLE_IDS = new Set([
  "com.google.Chrome",
  "com.google.Chrome.canary",
  "com.google.Chrome.beta",
  "com.brave.Browser",
  "company.thebrowser.Browser",
  "org.mozilla.firefox",
  "com.microsoft.edgemac",
  "com.apple.Safari",
]);

function connectNative() {
  if (typeof chrome === "undefined" || !chrome.runtime?.connectNative) {
    throw new Error("Native messaging unavailable");
  }
  return chrome.runtime.connectNative(NATIVE_HOST);
}

const NATIVE_TIMEOUT_MS = 2000;
const NATIVE_SUMMARIZE_TIMEOUT_MS = 5000;

export function nativeRequest(message, timeoutMs = NATIVE_TIMEOUT_MS) {
  const reqType = message?.type || "unknown";
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let port;
    try {
      port = connectNative();
    } catch (err) {
      dmError("bridge", "nativeRequest.connect", {
        type: reqType,
        ok: false,
        ms: Math.round(performance.now() - start),
        err: errMsg(err),
      });
      reject(err);
      return;
    }

    dmLog("bridge", "nativeRequest.start", { type: reqType, timeoutMs });

    let settled = false;
    const timer = setTimeout(() => {
      finish(reject, new Error("Native host timed out"));
    }, timeoutMs);

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        /* ignore */
      }
      fn(value);
    };

    const finishWithLog = (fn, value) => {
      const ms = Math.round(performance.now() - start);
      if (fn === resolve) {
        dmLog("bridge", "nativeRequest.ok", { type: reqType, ok: true, ms });
      } else {
        dmError("bridge", "nativeRequest.fail", { type: reqType, ok: false, ms, err: errMsg(value) });
      }
      finish(fn, value);
    };

    port.onMessage.addListener((msg) => {
      if (msg?.error) finishWithLog(reject, new Error(msg.error));
      else finishWithLog(resolve, msg);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError?.message || "Native host disconnected";
      finishWithLog(reject, new Error(err));
    });

    port.postMessage(message);
  });
}

export async function getDesktopDayMetrics(dateStr, timeoutMs = NATIVE_TIMEOUT_MS) {
  return nativeRequest({ type: "GET_DAY", date: dateStr }, timeoutMs);
}

/** Longer timeout + one retry for summarize (service worker may cold-start the host). */
export async function getDesktopDayMetricsForSummarize(dateStr) {
  try {
    return await getDesktopDayMetrics(dateStr, NATIVE_SUMMARIZE_TIMEOUT_MS);
  } catch (firstErr) {
    dmWarn("bridge", "getDesktopDayMetricsForSummarize.retry", {
      date: dateStr,
      err: errMsg(firstErr),
    });
    try {
      return await getDesktopDayMetrics(dateStr, NATIVE_SUMMARIZE_TIMEOUT_MS);
    } catch {
      throw firstErr;
    }
  }
}

export async function getSyncedDesktopDay(dateStr) {
  return nativeRequest({ type: "GET_SYNCED_DAY", date: dateStr });
}

export async function pingDesktopCompanion() {
  return nativeRequest({ type: "PING" });
}

export async function getDesktopLiveStatus() {
  return nativeRequest({ type: "GET_LIVE" });
}

export function isChromeApp(bundleId) {
  return bundleId && CHROME_BUNDLE_IDS.has(bundleId);
}
