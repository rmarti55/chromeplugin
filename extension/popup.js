import { getCurrentActivity, getSessionsForDay, aggregateByDomain, formatDuration, toDateStr } from "./db.js";

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

// Live capture indicator — refreshed once a second while the popup is open.
async function renderLive() {
  const dot = $("dot");
  const text = $("liveText");
  try {
    const a = await getCurrentActivity(Date.now());
    if (a.status === "capturing") {
      dot.className = "dot capturing";
      text.textContent = "";
      text.appendChild(document.createTextNode("Capturing · "));
      const site = document.createElement("span");
      site.className = "mono";
      site.textContent = a.domain;
      text.appendChild(site);
      text.appendChild(document.createTextNode(" · "));
      const t = document.createElement("span");
      t.className = "mono";
      t.textContent = formatDuration(a.elapsedSeconds);
      text.appendChild(t);
    } else if (a.status === "paused") {
      dot.className = "dot paused";
      text.textContent = "Paused — no active page";
    } else {
      dot.className = "dot";
      text.textContent = "Ready — browse to start tracking";
    }
  } catch {
    dot.className = "dot";
    text.textContent = "Ready";
  }
}

async function renderStats() {
  const el = $("stats");
  try {
    const sessions = await getSessionsForDay(todayStr(), Date.now());
    if (!sessions.length) {
      el.textContent = "No activity tracked yet today.";
      return;
    }
    const seconds = sessions.reduce((s, x) => s + x.seconds, 0);
    const domains = aggregateByDomain(sessions).length;
    el.textContent = "";
    el.appendChild(document.createTextNode("Today so far: "));
    const strongT = document.createElement("strong");
    strongT.textContent = formatDuration(seconds);
    el.appendChild(strongT);
    el.appendChild(document.createTextNode(" across "));
    const strongD = document.createElement("strong");
    strongD.textContent = String(domains);
    el.appendChild(strongD);
    el.appendChild(document.createTextNode(` site${domains === 1 ? "" : "s"}.`));
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
