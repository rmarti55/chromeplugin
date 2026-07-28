import { getDayMetrics, aggregateByDomain, formatDuration, toDateStr, classifyDay } from "./db.js";
import {
  getLiveStatus,
  chromeLiveStatusText,
  macLiveStatusText,
  popupDotClass,
} from "./live.js";
import { mergeDesktopWithChrome } from "./desktop-merge.js";
import { LABELS, clockPairCaption, quietDaySummary } from "./labels.js";

const $ = (id) => document.getElementById(id);
const todayStr = () => toDateStr(Date.now());

function showStatus(msg, type) {
  const el = $("status");
  el.textContent = msg;
  el.className = type;
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dist/index.html") });
}

function fetchDesktopDay(dateStr) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ payload: null, fetchOk: false }), 2500);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError || !res?.ok) {
        resolve({ payload: null, fetchOk: false });
        return;
      }
      resolve({ payload: res.data ?? null, fetchOk: true });
    });
  });
}

function renderLiveRow(dotEl, textEl, rowEl, row, isMac = false) {
  textEl.textContent = "";
  dotEl.className = popupDotClass(row.status);
  if (rowEl && isMac) {
    rowEl.classList.toggle("offline", row.status === "offline");
  }

  if (row.status === "paused" || row.status === "idle" || row.status === "offline") {
    textEl.appendChild(
      document.createTextNode(isMac ? macLiveStatusText(row) : chromeLiveStatusText(row))
    );
    return;
  }

  if (!isMac && row.domain) {
    const prefix = document.createElement("span");
    prefix.className = "live-prefix";
    prefix.textContent = `${LABELS.liveActiveOn} `;
    textEl.appendChild(prefix);
    const site = document.createElement("span");
    site.className = "live-focus";
    site.textContent = row.domain;
    textEl.appendChild(site);
    return;
  }

  if (isMac && row.appName) {
    const prefix = document.createElement("span");
    prefix.className = "live-prefix";
    prefix.textContent = `${LABELS.liveActiveOn} `;
    textEl.appendChild(prefix);
    const app = document.createElement("span");
    app.className = "live-focus";
    app.textContent = row.appName;
    textEl.appendChild(app);
    return;
  }

  textEl.appendChild(
    document.createTextNode(isMac ? macLiveStatusText(row) : chromeLiveStatusText(row))
  );
}

async function renderLive(macDayAvailable = false) {
  const chromeDot = $("chromeDot");
  const chromeText = $("chromeLiveText");
  const macRow = $("macLiveRow");
  const macDot = $("macDot");
  const macText = $("macLiveText");

  try {
    const { chrome, mac } = await getLiveStatus(Date.now(), { macDayAvailable });
    renderLiveRow(chromeDot, chromeText, null, chrome, false);

    if (mac) {
      macRow.hidden = false;
      renderLiveRow(macDot, macText, macRow, mac, true);
    } else {
      macRow.hidden = true;
    }
  } catch {
    chromeDot.className = "dot capturing";
    chromeText.textContent = LABELS.chromeOpen;
    macRow.hidden = true;
  }
}

function statRow(primary, secondary) {
  const row = document.createElement("div");
  row.className = "stat-row";

  const primaryEl = document.createElement("span");
  primaryEl.className = "stat-primary";
  primaryEl.textContent = formatDuration(primary);
  primaryEl.title = LABELS.tipPassive;
  row.appendChild(primaryEl);

  const sep = document.createElement("span");
  sep.className = "stat-sep";
  sep.textContent = "·";
  row.appendChild(sep);

  const secondaryEl = document.createElement("span");
  secondaryEl.className = "stat-secondary";
  secondaryEl.textContent = formatDuration(secondary);
  secondaryEl.title = LABELS.tipActive;
  row.appendChild(secondaryEl);

  return row;
}

function statBlock({ label, primary, secondary, caption, title, nested = false }) {
  const block = document.createElement("div");
  block.className = "stat-block";
  if (title) block.title = title;

  const labelEl = document.createElement("div");
  labelEl.className = "section-label";
  labelEl.textContent = label;
  block.appendChild(labelEl);

  block.appendChild(statRow(primary, secondary));

  const captionEl = document.createElement("div");
  captionEl.className = "stat-caption";
  captionEl.textContent = caption;
  block.appendChild(captionEl);

  if (nested) block.classList.add("stat-block--nested");
  return block;
}

async function renderStats(desktopResult) {
  const el = $("stats");
  try {
    const date = todayStr();
    const now = Date.now();
    const metrics = await getDayMetrics(date, now);
    const desktopRaw = desktopResult?.payload ?? null;
    const desktopFetchOk = desktopResult?.fetchOk ?? false;
    const desktop = mergeDesktopWithChrome(metrics, desktopRaw);
    const { openSeconds, activeSeconds, sessions } = metrics;
    const dayStatus = classifyDay({
      sessions,
      openSeconds,
      activeSeconds,
      desktopAvailable: desktop.available,
      desktopFetchOk,
    });

    if (dayStatus !== "active") {
      el.textContent = quietDaySummary(date, dayStatus, now);
      return;
    }

    const domains = aggregateByDomain(sessions).length;
    el.textContent = "";

    if (desktop.available) {
      el.appendChild(
        statBlock({
          label: LABELS.todayOnMac,
          primary: desktop.devicePresenceSeconds || 0,
          secondary: desktop.deviceActiveSeconds || 0,
          caption: clockPairCaption(),
          title: `${LABELS.tipPassiveMac} ${LABELS.tipActiveMac}`,
        })
      );
      el.appendChild(
        statBlock({
          label: LABELS.browsingChapter,
          primary: openSeconds,
          secondary: activeSeconds,
          caption: clockPairCaption(),
          title: LABELS.tipBrowsingChapter,
          nested: true,
        })
      );
      if (domains > 0) {
        const meta = document.createElement("div");
        meta.className = "stat-meta";
        meta.textContent = `${domains} site${domains === 1 ? "" : "s"}.`;
        el.appendChild(meta);
      }
      return;
    }

    el.appendChild(
      statBlock({
        label: LABELS.todayOnMac,
        primary: openSeconds,
        secondary: activeSeconds,
        caption: clockPairCaption(),
        title: `${LABELS.tipPassiveChrome} ${LABELS.tipActiveChrome}`,
      })
    );
    if (domains > 0) {
      const meta = document.createElement("div");
      meta.className = "stat-meta";
      meta.textContent = `${domains} site${domains === 1 ? "" : "s"}.`;
      el.appendChild(meta);
    }
  } catch {
    el.textContent = "Could not read local activity.";
  }
}

async function tick() {
  const date = todayStr();
  const desktopResult = await fetchDesktopDay(date);
  const macDayAvailable = !!(desktopResult?.payload?.apps?.length);
  await renderLive(macDayAvailable);
  await renderStats(desktopResult);
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });

  tick();
  const interval = setInterval(tick, 1000);
  window.addEventListener("unload", () => clearInterval(interval));

  $("dashboardBtn").addEventListener("click", openDashboard);
  $("dashLink").addEventListener("click", (e) => {
    e.preventDefault();
    openDashboard();
  });

  $("summarizeBtn").addEventListener("click", async () => {
    const { apiKey } = await chrome.storage.local.get("apiKey");
    if (!apiKey) {
      showStatus("Add your API key in the dashboard first — opening it now.", "error");
      setTimeout(openDashboard, 900);
      return;
    }

    $("summarizeBtn").disabled = true;
    showStatus("Writing your daily narrative… (10–30s)", "loading");

    const date = todayStr();
    const desktopResult = await fetchDesktopDay(date);
    const desktopPayload = desktopResult?.payload ?? null;

    chrome.runtime.sendMessage({ type: "ANALYZE_DAY", date, desktopPayload }, (res) => {
      $("summarizeBtn").disabled = false;
      if (chrome.runtime.lastError) {
        showStatus(`Error: ${chrome.runtime.lastError.message}`, "error");
      } else if (res && res.ok) {
        showStatus("Done! Opening your dashboard…", "success");
        openDashboard();
      } else {
        showStatus(`Error: ${res?.error || "unknown"}`, "error");
      }
    });
  });
});
