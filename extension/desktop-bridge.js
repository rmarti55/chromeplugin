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

const NATIVE_TIMEOUT_MS = 2000;
const NATIVE_SUMMARIZE_TIMEOUT_MS = 5000;

let nativePort = null;
const requestQueue = [];
let inFlight = null;

function connectNativePort() {
  if (typeof chrome === "undefined" || !chrome.runtime?.connectNative) {
    throw new Error("Native messaging unavailable");
  }
  return chrome.runtime.connectNative(NATIVE_HOST);
}

function teardownNativePort() {
  if (!nativePort) return;
  try {
    nativePort.disconnect();
  } catch {
    /* ignore */
  }
  nativePort = null;
}

function settleInFlight(fn, value) {
  if (!inFlight || inFlight.settled) return;
  inFlight.settled = true;
  clearTimeout(inFlight.timer);
  const { resolve, reject, reqType, start } = inFlight;
  const ms = Math.round(performance.now() - start);
  if (fn === resolve) {
    dmLog("bridge", "nativeRequest.ok", { type: reqType, ok: true, ms });
  } else {
    dmError("bridge", "nativeRequest.fail", { type: reqType, ok: false, ms, err: errMsg(value) });
  }
  fn(value);
  inFlight = null;
  processRequestQueue();
}

function onNativePortMessage(msg) {
  if (!inFlight || inFlight.settled) return;
  if (msg?.error) settleInFlight(inFlight.reject, new Error(msg.error));
  else settleInFlight(inFlight.resolve, msg);
}

function onNativePortDisconnect() {
  nativePort = null;
  if (!inFlight || inFlight.settled) return;
  const err = chrome.runtime.lastError?.message || "Native host disconnected";
  settleInFlight(inFlight.reject, new Error(err));
}

function ensureNativePort() {
  if (nativePort) return nativePort;
  nativePort = connectNativePort();
  nativePort.onMessage.addListener(onNativePortMessage);
  nativePort.onDisconnect.addListener(onNativePortDisconnect);
  return nativePort;
}

function startNativeRequest(item) {
  const { message, timeoutMs, resolve, reject, reqType, start } = item;

  try {
    ensureNativePort().postMessage(message);
  } catch (err) {
    teardownNativePort();
    dmError("bridge", "nativeRequest.connect", {
      type: reqType,
      ok: false,
      ms: Math.round(performance.now() - start),
      err: errMsg(err),
    });
    reject(err);
    processRequestQueue();
    return;
  }

  const timer = setTimeout(() => {
    if (!inFlight || inFlight.settled) return;
    teardownNativePort();
    settleInFlight(inFlight.reject, new Error("Native host timed out"));
  }, timeoutMs);

  inFlight = { resolve, reject, timer, reqType, start, settled: false };
}

function processRequestQueue() {
  if (inFlight || requestQueue.length === 0) return;
  startNativeRequest(requestQueue.shift());
}

export function nativeRequest(message, timeoutMs = NATIVE_TIMEOUT_MS) {
  const reqType = message?.type || "unknown";
  const start = performance.now();

  dmLog("bridge", "nativeRequest.start", { type: reqType, timeoutMs });

  return new Promise((resolve, reject) => {
    requestQueue.push({ message, timeoutMs, resolve, reject, reqType, start });
    processRequestQueue();
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
