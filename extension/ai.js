// Daily AI narrative — the product's differentiator.
//
// Bring-your-own-key: the user's OpenRouter key lives in chrome.storage.local
// (unreadable by web pages) and we call OpenRouter directly from the service
// worker. host_permissions for openrouter.ai lets this bypass CORS. No server.

import {
  getSessionsForDay,
  sessionsToHistoryEntries,
  aggregateByDomain,
  saveAnalysis,
} from "./db.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiKey", "model", "goals"], (d) => resolve(d));
  });
}

function buildDomainSummary(entries) {
  const byDomain = {};
  for (const e of entries) {
    if (!byDomain[e.domain]) byDomain[e.domain] = { minutes: 0, titles: [], visits: 0 };
    byDomain[e.domain].minutes += e.duration / 60;
    byDomain[e.domain].visits += e.visitCount;
    if (e.title && !byDomain[e.domain].titles.includes(e.title) && byDomain[e.domain].titles.length < 5) {
      byDomain[e.domain].titles.push(e.title);
    }
  }
  return Object.entries(byDomain)
    .sort(([, a], [, b]) => b.minutes - a.minutes)
    .map(([domain, d]) => `- ${domain}: ${Math.round(d.minutes)} min, ${d.visits} visits\n  Pages: ${d.titles.join(", ")}`)
    .join("\n");
}

function buildPrompt(date, domainSummary, totalMinutes, goalText) {
  const goalBlock = goalText
    ? `\nThe person wrote down what they were trying to do:\n"${goalText}"\n`
    : "";
  const goalRule = goalText
    ? `- "goalAssessment": one honest sentence comparing the stated goal to how the time was actually spent (name specific sites and minutes).`
    : `- "goalAssessment": null (no goal was set).`;

  return `You are a calm, honest mirror for how someone spent their day online. This is for the person themselves — not a manager. Be specific and kind but do not flatter.

Browsing activity for ${date} (time spent is MEASURED active time, not an estimate):
${domainSummary}

Total active time: ${totalMinutes} minutes
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
- Categories are broad ("Software Development", "Social Media", "Entertainment", "Research", "Communication", "Shopping", "News", "Productivity", "Finance", "Health", "Education", "Travel").
- Themes are specific clusters ("Learning React hooks", "Job searching").
- Percentages must sum to 100. Category minutes must sum to ${totalMinutes}.
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

// Coerce the model output into a well-formed analysis, tolerating omissions and
// scrubbing any banned/empty category labels down to a concrete fallback.
function normalize(parsed) {
  const categories = (Array.isArray(parsed.categories) ? parsed.categories : [])
    .filter((c) => c && typeof c.name !== "undefined")
    .map((c) => ({ ...c, name: clean(c.name) }));

  const themes = (Array.isArray(parsed.themes) ? parsed.themes : [])
    .filter((t) => t && !isBanned(t.name))
    .map((t) => ({ ...t, sites: Array.isArray(t.sites) ? t.sites : [] }));

  // domain (lowercased, no www) -> concrete category
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
  const { apiKey, model, goals } = await getSettings();
  if (!apiKey) {
    throw new Error("No API key set. Add your OpenRouter key in the extension popup.");
  }

  const sessions = await getSessionsForDay(dateStr, Date.now());
  if (!sessions.length) {
    throw new Error("No tracked activity for this day yet.");
  }

  const entries = sessionsToHistoryEntries(sessions);
  const totalMinutes = Math.round(entries.reduce((s, e) => s + e.duration, 0) / 60);
  const goalText = (goals || "").trim();
  const prompt = buildPrompt(dateStr, buildDomainSummary(entries), totalMinutes, goalText);

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chrome-activity-analyzer",
      "X-Title": "Chrome Activity Analyzer",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
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

  // Merge the learned domain→category map into storage so the instant (no-AI)
  // dashboard view shows real categories for these domains going forward.
  const existing = (await chrome.storage.local.get("domainCategories")).domainCategories || {};
  const mergedDomainCategories = { ...existing, ...parsed.domainCategories };
  await chrome.storage.local.set({ domainCategories: mergedDomainCategories });

  const analysis = {
    date: dateStr,
    ...parsed,
    goalText,
    topDomains: aggregateByDomain(sessions).slice(0, 10),
    totalMinutes,
    analyzedAt: new Date().toISOString(),
  };

  await saveAnalysis(analysis);
  return analysis;
}
