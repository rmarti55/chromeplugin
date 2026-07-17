import { getDayMetrics, aggregateByDomain, formatDuration, toDateStr } from "./db.js";
import { getLiveStatus } from "./live.js";
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

async function renderLive() {
  const dot = $("dot");
  const text = $("liveText");
  try {
    const a = await getLiveStatus(Date.now());
    text.textContent = "";
    if (a.status === "paused") {
      dot.className = "dot paused";
      text.appendChild(document.createTextNode(a.message || LABELS.inBackground));
    } else if (a.status === "idle") {
      dot.className = "dot paused";
      text.appendChild(document.createTextNode(a.message || LABELS.idle));
    } else if (a.domain) {
      dot.className = "dot capturing";
      text.appendChild(document.createTextNode(`${LABELS.usingChromeOn} `));
      const site = document.createElement("span");
      site.className = "mono";
      site.textContent = a.domain;
      text.appendChild(site);
    } else {
      dot.className = "dot capturing";
      text.appendChild(document.createTextNode(a.message || LABELS.inChrome));
    }
  } catch {
    dot.className = "dot capturing";
    text.textContent = LABELS.inChrome;
  }
}

async function renderStats() {
  const el = $("stats");
  try {
    const { openSeconds, activeSeconds, sessions } = await getDayMetrics(todayStr(), Date.now());
    if (!sessions.length && openSeconds === 0) {
      el.textContent = "No activity tracked yet today.";
      return;
    }
    const domains = aggregateByDomain(sessions).length;
    el.textContent = "";
    el.appendChild(document.createTextNode(`${LABELS.inChrome}: `));
    const strongOpen = document.createElement("strong");
    strongOpen.textContent = formatDuration(openSeconds);
    el.appendChild(strongOpen);
    el.appendChild(document.createTextNode(` · ${LABELS.usingChrome}: `));
    const strongActive = document.createElement("strong");
    strongActive.textContent = formatDuration(activeSeconds);
    el.appendChild(strongActive);
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

    chrome.runtime.sendMessage({ type: "ANALYZE_DAY", date: todayStr() }, (res) => {
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
