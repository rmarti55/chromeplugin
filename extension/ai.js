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
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

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
  "timeline": [ { "hour": "9am", "activity": "Brief description of activity in this hour" } ]
}

Rules:
- Categories are broad ("Software Development", "Social Media", "Entertainment", "Research", "Communication", "Shopping", "News", "Productivity").
- Themes are specific clusters ("Learning React hooks", "Job searching").
- Percentages must sum to 100. Category minutes must sum to ${totalMinutes}.
${goalRule}`;
}

function extractJson(content) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON from the AI response.");
  return JSON.parse(match[0]);
}

// Coerce the model output into a well-formed analysis, tolerating omissions.
function normalize(parsed) {
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    observation: typeof parsed.observation === "string" ? parsed.observation : "",
    goalAssessment: typeof parsed.goalAssessment === "string" ? parsed.goalAssessment : null,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
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
