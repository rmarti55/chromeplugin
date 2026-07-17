import { getDayMetrics, aggregateByDomain, formatDuration, toDateStr } from "./db.js";
import { getLiveStatus, liveStatusText } from "./live.js";
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

async function renderLive() {
  const dot = $("dot");
  const text = $("liveText");
  try {
    const date = todayStr();
    const desktopRaw = await fetchDesktopDay(date);
    const macDayAvailable = !!(desktopRaw?.apps?.length);
    const a = await getLiveStatus(Date.now(), { macDayAvailable });
    text.textContent = "";
    if (a.status === "offline") {
      dot.className = "dot offline";
      text.appendChild(document.createTextNode(a.message || LABELS.macOffline));
    } else if (a.status === "paused") {
      dot.className = "dot paused";
      text.appendChild(document.createTextNode(a.message || LABELS.inBackground));
    } else if (a.status === "idle") {
      dot.className = "dot idle";
      text.appendChild(document.createTextNode(a.message || LABELS.idle));
    } else if (a.domain) {
      dot.className = "dot capturing";
      text.appendChild(document.createTextNode(`${LABELS.usingChromeOn} `));
      const site = document.createElement("span");
      site.className = "mono";
      site.textContent = a.domain;
      text.appendChild(site);
    } else if (a.appName) {
      dot.className = "dot capturing";
      text.appendChild(document.createTextNode(`${LABELS.usingMacOn} `));
      const app = document.createElement("span");
      app.className = "mono";
      app.textContent = a.appName;
      text.appendChild(app);
    } else {
      dot.className = "dot capturing";
      text.appendChild(document.createTextNode(liveStatusText(a) || LABELS.inChrome));
    }
  } catch {
    dot.className = "dot capturing";
    text.textContent = LABELS.inChrome;
  }
}

function appendStrong(parent, text) {
  const el = document.createElement("strong");
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

async function renderStats() {
  const el = $("stats");
  try {
    const date = todayStr();
    const now = Date.now();
    const [metrics, desktopRaw] = await Promise.all([getDayMetrics(date, now), fetchDesktopDay(date)]);
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

function tick() {
  renderLive();
  renderStats();
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
