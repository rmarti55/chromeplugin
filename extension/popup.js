import { getSessionsForDay, aggregateByDomain, toDateStr } from "./db.js";

const $ = (id) => document.getElementById(id);

function todayStr() {
  return toDateStr(Date.now());
}

function showStatus(msg, type) {
  const el = $("status");
  el.textContent = msg;
  el.className = type;
}

// Build "Today so far: <b>1h 20m</b> of active time across <b>7</b> sites."
// using DOM nodes (never innerHTML) so the emphasized numbers stay safe.
function renderStats(el, parts) {
  el.textContent = "";
  for (const p of parts) {
    if (typeof p === "string") {
      el.appendChild(document.createTextNode(p));
    } else {
      const strong = document.createElement("strong");
      strong.textContent = p.strong;
      el.appendChild(strong);
    }
  }
}

async function loadStats() {
  const el = $("stats");
  try {
    const sessions = await getSessionsForDay(todayStr(), Date.now());
    if (!sessions.length) {
      el.textContent = "No activity tracked yet today — browse a little and check back.";
      return;
    }
    const minutes = Math.round(sessions.reduce((s, x) => s + x.seconds, 0) / 60);
    const domains = aggregateByDomain(sessions).length;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    renderStats(el, [
      "Today so far: ",
      { strong: timeStr },
      " of active time across ",
      { strong: String(domains) },
      ` site${domains === 1 ? "" : "s"}.`,
    ]);
  } catch (e) {
    el.textContent = "Could not read local activity.";
  }
}

function bindSetting(id, key) {
  const el = $(id);
  el.addEventListener("change", () => {
    chrome.storage.local.set({ [key]: el.value });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Clear the nudge badge when the user opens the popup.
  chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });

  // Load saved settings.
  const saved = await chrome.storage.local.get(["apiKey", "model", "goals"]);
  if (saved.apiKey) $("apiKey").value = saved.apiKey;
  if (saved.model) $("model").value = saved.model;
  if (saved.goals) $("goals").value = saved.goals;

  bindSetting("apiKey", "apiKey");
  bindSetting("model", "model");
  bindSetting("goals", "goals");

  loadStats();

  $("dashboardBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dist/index.html") });
  });

  $("summarizeBtn").addEventListener("click", () => {
    // Persist any unsaved field edits first.
    chrome.storage.local.set({
      apiKey: $("apiKey").value,
      model: $("model").value,
      goals: $("goals").value,
    });

    if (!$("apiKey").value.trim()) {
      showStatus("Add your OpenRouter API key first.", "error");
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
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dist/index.html") });
      } else {
        showStatus(`Error: ${res?.error || "unknown"}`, "error");
      }
    });
  });
});
