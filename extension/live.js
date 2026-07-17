// Live status for the popup and dashboard.
//
// Queries real Chrome focus + idle state (not the event log) so opening the
// popup does not falsely show "paused". Time accounting still uses the log.

import { getCurrentActivity } from "./db.js";
import { IDLE_SECONDS } from "./constants.js";
import { LABELS } from "./labels.js";

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
    return getCurrentActivity(now);
  }

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  } catch {
    /* no tab */
  }

  // Chrome is not the focused app — neither clock is accruing.
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
