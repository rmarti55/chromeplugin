// Daily AI narrative — the product's differentiator.
//
// Bring-your-own-key: the user's OpenRouter key lives in chrome.storage.local
// (unreadable by web pages) and we call OpenRouter directly from the service
// worker. host_permissions for openrouter.ai lets this bypass CORS. No server.

import {
  getDayMetrics,
  sessionsToHistoryEntries,
  aggregateByDomain,
  saveAnalysis,
  getLastEventTsInDay,
} from "./db.js";
import { getHistoryForDay } from "./history.js";
import { resolveModelSlug, estimateCostUsd } from "./models.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiKey", "model", "modelPreset", "goals"], (d) => resolve(d));
  });
}

function buildDomainSummary(entries, domainHints = {}) {
  const byDomain = {};
  for (const e of entries) {
    if (!byDomain[e.domain]) byDomain[e.domain] = { minutes: 0, titles: [] };
    byDomain[e.domain].minutes += e.duration / 60;
    if (e.title && !byDomain[e.domain].titles.includes(e.title) && byDomain[e.domain].titles.length < 5) {
      byDomain[e.domain].titles.push(e.title);
    }
  }
  return Object.entries(byDomain)
    .sort(([, a], [, b]) => b.minutes - a.minutes)
    .map(([domain, d]) => {
      const hint = domainHints[domain];
      const hintLine =
        hint?.automationHint && hint.automationHint !== "none" && hint.hintNote
          ? `\n  Pattern: ${hint.hintNote}`
          : "";
      return `- ${domain}: ${Math.round(d.minutes)} min active use\n  Pages: ${d.titles.join(", ")}${hintLine}`;
    })
    .join("\n");
}

function buildPrompt(date, domainSummary, openMinutes, activeMinutes, goalText, historyNote = "") {
  const goalBlock = goalText
    ? `\nThe person wrote down what they were trying to do:\n"${goalText}"\n`
    : "";
  const goalRule = goalText
    ? `- "goalAssessment": one honest sentence comparing the stated goal to how the time was actually spent (name specific sites and active-use minutes).`
    : `- "goalAssessment": null (no goal was set).`;

  const gapNote =
    openMinutes > activeMinutes * 1.25
      ? `\nNote: Chrome open (${openMinutes} min) is much higher than active use (${activeMinutes} min) — mention reading without input, Chrome open while working in other apps, or rapid automated browsing if patterns are flagged.`
      : "";

  return `You are a calm, honest mirror for how someone spent their day online. This is for the person themselves — not a manager. Be specific and kind but do not flatter.

Browsing activity for ${date} (NOT Chrome History):
${domainSummary}

Chrome open: ${openMinutes} minutes (Chrome was the focused app)
Active use: ${activeMinutes} minutes (Chrome focused + recent mouse/keyboard input)
${gapNote}${historyNote}
${goalBlock}
Respond with ONLY valid JSON in this exact format:
{
  "summary": "A 3-4 sentence narrative of how the day was spent, in second person ('you').",
  "observation": "One honest, non-judgmental observation about a pattern in the day.",
  "goalAssessment": "see rule below",
  "categories": [ { "name": "Category Name", "minutes": 120, "percentage": 30 } ],
  "themes": [ { "name": "Theme description", "sites": ["domain1.com"], "minutes": 60 } ],
  "siteCategories": [ { "domain": "domain1.com", "category": "Category Name" } ]
}

Rules:
- Lead with active-use minutes, themes, and what the person did — never navigation or visit counts from Mirror.
- If Chrome History reference is provided, treat visit counts and gap-estimated dwell as context only — compare trends to Mirror active use and Chrome open, never replace Mirror minutes.
- Category and theme minutes must reflect ACTIVE USE only and sum to ${activeMinutes}.
- If Chrome open >> active use, include one sentence explaining the gap (reading, other apps, automation patterns).
- If a domain has a "Pattern:" note, mention possible testing, automation, or rapid lookups — never claim Claude, Codex, or Cursor initiated activity unless the person simply visited that product's website.
- Categories are broad ("Software Development", "Social Media", "Entertainment", "Research", "Communication", "Shopping", "News", "Productivity", "Finance", "Health", "Education", "Travel").
- Themes are specific clusters ("Learning React hooks", "Job searching").
- Percentages must sum to 100.
- "siteCategories" MUST include EVERY domain listed above, each mapped to its best-fit concrete category.
- CRITICAL: never use "Other", "Unknown", "Uncategorized", "Miscellaneous", "Misc", "N/A", or an empty value anywhere. For anything ambiguous, choose the closest real category. Every name and category must be a specific, human-meaningful label.
${goalRule}`;
}

// Category names we refuse to display — always resolve to something concrete.
const BANNED = /^(other|others|unknown|uncategori[sz]ed|misc(ellaneous)?|n\/?a|none|general|tbd|\?+)?$/i;
function isBanned(name) {
  return !name || typeof name !== "string" || BANNED.test(name.trim());
}

function extractJson(content) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON from the AI response.");
  return JSON.parse(match[0]);
}

const FALLBACK = "General Browsing";
const clean = (name) => (isBanned(name) ? FALLBACK : name.trim());

function normalize(parsed) {
  const categories = (Array.isArray(parsed.categories) ? parsed.categories : [])
    .filter((c) => c && typeof c.name !== "undefined")
    .map((c) => ({
      ...c,
      name: clean(c.name),
      seconds: c.seconds ?? Math.round((c.minutes || 0) * 60),
    }));

  const themes = (Array.isArray(parsed.themes) ? parsed.themes : [])
    .filter((t) => t && !isBanned(t.name))
    .map((t) => ({ ...t, sites: Array.isArray(t.sites) ? t.sites : [] }));

  const domainCategories = {};
  if (Array.isArray(parsed.siteCategories)) {
    for (const sc of parsed.siteCategories) {
      if (!sc || !sc.domain) continue;
      const host = String(sc.domain).toLowerCase().replace(/^www\./, "");
      domainCategories[host] = clean(sc.category);
    }
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    observation: typeof parsed.observation === "string" ? parsed.observation : "",
    goalAssessment: typeof parsed.goalAssessment === "string" ? parsed.goalAssessment : null,
    categories,
    themes,
    domainCategories,
  };
}

export async function analyzeDay(dateStr) {
  const settings = await getSettings();
  const { apiKey, goals } = settings;
  const modelSlug = resolveModelSlug(settings);
  if (!apiKey) {
    throw new Error("No API key set. Add your OpenRouter key in the extension popup.");
  }

  const now = Date.now();
  const [metrics, history] = await Promise.all([
    getDayMetrics(dateStr, now),
    getHistoryForDay(dateStr, now).catch(() => ({ available: false })),
  ]);
  const { sessions, domainHints, activeSeconds, openSeconds } = metrics;
  if (!sessions.length && openSeconds === 0) {
    throw new Error("No tracked activity for this day yet.");
  }

  const entries = sessionsToHistoryEntries(sessions);
  const activeMinutes = Math.round(activeSeconds / 60);
  const openMinutes = Math.round(openSeconds / 60);
  const lastEventTs = await getLastEventTsInDay(dateStr, now);
  const goalText = (goals || "").trim();
  const historyNote =
    history.available && history.historyVisitCount > 0
      ? `\nFor reference only (NOT Mirror time): Chrome History recorded ${history.historyVisitCount} visits (est. dwell from gaps ≈ ${Math.round((history.estimatedDwellSeconds || 0) / 60)} min) across ${history.historyDomainCount} sites today. Do not treat History dwell as measured time-on-site.`
      : "";
  const prompt = buildPrompt(
    dateStr,
    buildDomainSummary(entries, domainHints),
    openMinutes,
    activeMinutes,
    goalText,
    historyNote
  );

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chrome-activity-analyzer",
      "X-Title": "Chrome Activity Analyzer",
    },
    body: JSON.stringify({
      model: modelSlug,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from the AI model.");

  const parsed = normalize(extractJson(content));

  const existing = (await chrome.storage.local.get("domainCategories")).domainCategories || {};
  const mergedDomainCategories = { ...existing, ...parsed.domainCategories };
  await chrome.storage.local.set({ domainCategories: mergedDomainCategories });

  const analysis = {
    date: dateStr,
    ...parsed,
    goalText,
    topDomains: aggregateByDomain(sessions, domainHints).slice(0, 10),
    activeMinutes,
    openMinutes,
    totalMinutes: activeMinutes,
    analyzedAt: new Date().toISOString(),
    activityFingerprint: { activeSeconds, openSeconds, lastEventTs },
    model: modelSlug,
    usage: data.usage || null,
    estimatedCostUsd: estimateCostUsd(data.usage, modelSlug),
  };

  await saveAnalysis(analysis);
  return analysis;
}
