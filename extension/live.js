// Live "am I capturing right now" status for the popup and dashboard.
//
// IMPORTANT: this must NOT be derived from the event log. Opening the popup
// makes the browser window lose focus, which logs a `blur` event — so reading
// the last event would show "Paused" every time the user opens the popup to
// check. Instead we query the ACTUAL active tab and the REAL idle state, which
// are immune to the popup stealing focus. (Time accounting still uses the event
// log; this is only the live indicator.)

import { getCurrentActivity } from "./db.js";

function host(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
const isWeb = (u) => !!u && /^https?:\/\//.test(u);

export async function getLiveStatus(now = Date.now()) {
  const hasChrome = typeof chrome !== "undefined" && chrome.tabs && chrome.idle;
  if (!hasChrome) {
    // dev/preview without extension APIs: fall back to the event log
    return getCurrentActivity(now);
  }

  let idleState = "active";
  try {
    idleState = await chrome.idle.queryState(60);
  } catch {
    /* keep default */
  }

  // The ONLY legitimate paused state: the user is genuinely idle or the screen
  // is locked. Being on the dashboard / a non-web tab is NOT paused — capture is
  // always running in the background.
  if (idleState !== "active") return { status: "paused", reason: idleState };

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  } catch {
    /* no tab */
  }

  // On a web page → show it. On the dashboard / a browser page → still
  // capturing, just no specific site to name.
  if (tab && isWeb(tab.url)) return { status: "capturing", domain: host(tab.url) };
  return { status: "capturing" };
}
