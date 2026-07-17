import { getDayMetrics, aggregateByDomain, formatDuration, toDateStr } from "./db.js";
import {
  getLiveStatus,
  chromeLiveStatusText,
  macLiveStatusText,
  popupDotClass,
} from "./live.js";
import { mergeDesktopWithChrome } from "./desktop-merge.js";
import { LABELS } from "./labels.js";

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
    const timer = setTimeout(() => resolve(null), 2500);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError || !res?.ok) {
        resolve(null);
        return;
      }
      resolve(res.data);
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
    textEl.appendChild(document.createTextNode(`${LABELS.usingChromeOn} `));
    const site = document.createElement("span");
    site.className = "mono";
    site.textContent = row.domain;
    textEl.appendChild(site);
    return;
  }

  if (isMac && row.appName) {
    textEl.appendChild(document.createTextNode(`${LABELS.usingMacOn} `));
    const app = document.createElement("span");
    app.className = "mono";
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
    chromeText.textContent = LABELS.inChrome;
    macRow.hidden = true;
  }
}

function appendStrong(parent, text) {
  const el = document.createElement("strong");
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

async function renderStats(desktopRaw) {
  const el = $("stats");
  try {
    const date = todayStr();
    const now = Date.now();
    const metrics = await getDayMetrics(date, now);
    const desktop = mergeDesktopWithChrome(metrics, desktopRaw);
    const { openSeconds, activeSeconds, sessions } = metrics;

    if (!sessions.length && openSeconds === 0 && !desktop.available) {
      el.textContent = "No activity tracked yet today.";
      return;
    }

    const domains = aggregateByDomain(sessions).length;
    el.textContent = "";

    if (desktop.available) {
      el.appendChild(document.createTextNode(`${LABELS.onMac}: `));
      appendStrong(el, formatDuration(desktop.devicePresenceSeconds || 0));
      el.appendChild(document.createTextNode(` · ${LABELS.usingMac}: `));
      appendStrong(el, formatDuration(desktop.deviceActiveSeconds || 0));
      el.appendChild(document.createElement("br"));

      const browsing = document.createElement("span");
      browsing.className = "browsing-line";
      browsing.appendChild(document.createTextNode(`${LABELS.browsingChapter} — ${LABELS.inChrome}: `));
      appendStrong(browsing, formatDuration(openSeconds));
      browsing.appendChild(document.createTextNode(` · ${LABELS.usingChrome}: `));
      appendStrong(browsing, formatDuration(activeSeconds));
      el.appendChild(browsing);

      if (domains > 0) {
        el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(`${domains} site${domains === 1 ? "" : "s"}.`));
      }
      return;
    }

    el.appendChild(document.createTextNode(`${LABELS.inChrome}: `));
    appendStrong(el, formatDuration(openSeconds));
    el.appendChild(document.createTextNode(` · ${LABELS.usingChrome}: `));
    appendStrong(el, formatDuration(activeSeconds));
    if (domains > 0) {
      el.appendChild(document.createTextNode(` · ${domains} site${domains === 1 ? "" : "s"}.`));
    } else {
      el.appendChild(document.createTextNode("."));
    }
  } catch {
    el.textContent = "Could not read local activity.";
  }
}

async function tick() {
  const date = todayStr();
  const desktopRaw = await fetchDesktopDay(date);
  const macDayAvailable = !!(desktopRaw?.apps?.length);
  await renderLive(macDayAvailable);
  await renderStats(desktopRaw);
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
    const desktopPayload = await fetchDesktopDay(date);

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
