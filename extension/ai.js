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
  formatDuration,
} from "./db.js";
import { getHistoryForDay, compareDayToHistory, getTopMisalignedDomains } from "./history.js";
import { DEFAULT_MODEL, estimateCostUsd } from "./models.js";
import { getDesktopDayMetricsForSummarize } from "./desktop-bridge.js";
import { mergeDesktopWithChrome, buildDesktopSummaryForAI } from "./desktop-merge.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiKey", "goals"], (d) => resolve(d));
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
      return `- ${domain}: ${Math.round(d.minutes)} min using Chrome\n  Pages: ${d.titles.join(", ")}${hintLine}`;
    })
    .join("\n");
}

function buildHistoryContext(metrics, history, hasDesktop = false) {
  if (!history?.available || !history.historyVisitCount) return "";

  const alignment = compareDayToHistory(metrics, history);
  const misaligned = getTopMisalignedDomains(alignment, history, 5);

  const label = hasDesktop
    ? "Chrome History (reference only — do NOT let this dominate the summary)"
    : "Chrome History (reference only — NOT Mirror time)";

  const aggregate = `${label}: ${history.historyVisitCount} visits across ${history.historyDomainCount} sites; gap-estimated dwell ≈ ${Math.round((history.estimatedDwellSeconds || 0) / 60)} min total. Never use History dwell as "using Chrome" minutes in categories or themes.`;

  if (!misaligned.length) {
    return `\n${aggregate}\nHistory and Mirror visit patterns are broadly aligned today.`;
  }

  const lines = misaligned.map((m) => {
    const kind = m.historyOnly
      ? "History-only (Mirror saw no navigations — background tab or before tracking)"
      : m.alignment === "mirror_low"
        ? "History >> Mirror visits"
        : m.alignment === "dwell_high"
          ? "History est. dwell >> using Chrome"
          : "visit count mismatch";
    const titles = m.titles.length ? `\n    Pages: ${m.titles.join("; ")}` : "";
    return `- ${m.domain}: ${kind}; History ${m.historyVisits} visits (est. ${m.historyDwellMinutes}m), Mirror ${m.mirrorVisits} navs / ${m.mirrorActiveMinutes}m using Chrome${titles}`;
  });

  return `\n${aggregate}\nTop History/Mirror gaps (context only — never as minute totals):\n${lines.join("\n")}`;
}

function buildPrompt(
  date,
  domainSummary,
  openMinutes,
  activeMinutes,
  goalText,
  historyContext = "",
  desktopMerge = null,
  strictMac = false
) {
  const goalBlock = goalText
    ? `\nThe person wrote down what they were trying to do:\n"${goalText}"\n`
    : "";
  const goalRule = goalText
    ? hasDesktopRule(desktopMerge)
      ? `- "goalAssessment": one honest sentence comparing the stated goal to how the time was actually spent across the Mac day and Chrome browsing (name specific apps, sites, and minutes).`
      : `- "goalAssessment": one honest sentence comparing the stated goal to how the time was actually spent (name specific sites, apps, and minutes).`
    : `- "goalAssessment": null (no goal was set).`;

  const hasDesktop = desktopMerge?.available;
  const devicePresence = Math.round((desktopMerge?.devicePresenceSeconds || 0) / 60);
  const deviceActive = Math.round((desktopMerge?.deviceActiveSeconds || 0) / 60);
  const desktopContext = hasDesktop ? buildDesktopSummaryForAI(desktopMerge) : "";

  const gapNote = hasDesktop
    ? devicePresence > deviceActive * 1.25
      ? `\nNote: On your Mac in front (${devicePresence} min) is much higher than in use (${deviceActive} min) — mention apps left in front without input or reading without typing.`
      : openMinutes > activeMinutes * 1.25
        ? `\nNote: In Chrome (${openMinutes} min) is much higher than using Chrome (${activeMinutes} min) — mention passive reading in Chrome.`
        : ""
    : openMinutes > activeMinutes * 1.25
      ? `\nNote: In Chrome (${openMinutes} min) is much higher than using Chrome (${activeMinutes} min) — mention reading without input, Chrome in front while working in other apps, or rapid automated browsing if patterns are flagged.`
      : "";

  const activityBlock = hasDesktop
    ? `${desktopContext}

Browsing in Chrome (website detail — NOT added to Mac totals above):
${domainSummary}

In Chrome: ${openMinutes} min (browser in front)
Using Chrome: ${activeMinutes} min (in front + recent input; Chrome idle API: active)`
    : `Browsing activity for ${date} (NOT Chrome History):
${domainSummary}

In Chrome: ${openMinutes} min (browser in front)
Using Chrome: ${activeMinutes} min (in front + recent input; Chrome idle API: active)`;

  const opener = hasDesktop
    ? "You are a calm, honest mirror for how someone spent their day on this Mac."
    : "You are a calm, honest mirror for how someone spent their day online.";

  const macCriticalRule = hasDesktop
    ? `- CRITICAL: The first sentence of "summary" MUST state "On your Mac: ${devicePresence} min in front, ${deviceActive} min in use" (use these exact numbers) and name at least one non-browser app with minutes, OR state explicitly that only Chrome was used if no other apps appear above. Do NOT open with Chrome-only minutes.`
    : "";

  const strictBlock = strictMac
    ? `\nREWRITE REQUIRED: Your previous response omitted Mac companion data. The summary MUST lead with On your Mac totals and name desktop apps.\n`
    : "";

  const leadRule = hasDesktop
    ? `- Lead the summary with the whole Mac day (On your Mac / Using your Mac), then other apps by name with minutes, then Chrome browsing detail. The summary must cover Mac + Chrome — never Chrome alone.`
    : `- Lead with minutes using Chrome, themes, and what the person did — never navigation or visit counts from Mirror.`;

  const observationRule = hasDesktop
    ? `- The observation may cover Mac-wide patterns (app switching, long in-front vs in-use gaps) or Chrome-specific patterns; prefer Mac-wide when both exist.`
    : `- If in Chrome >> using Chrome, include one sentence explaining the gap (reading, other apps, automation patterns).`;

  const historyRule = hasDesktop
    ? `- Chrome History is reference only for browsing blind spots — do not let History gaps dominate the summary or observation when Mac app data is present.`
    : `- If Chrome History reference is provided, treat visit counts and gap-estimated dwell as context only — mention History-only or misaligned sites when relevant, compare trends to using Chrome and in Chrome, never replace Mirror minutes.`;

  return `${strictBlock}${opener} This is for the person themselves — not a manager. Be specific and kind but do not flatter.

${activityBlock}
${gapNote}${historyContext}
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
${leadRule}
${macCriticalRule}
${historyRule}
- Category and theme minutes must reflect USING CHROME only (website time) and sum to ${activeMinutes}.
- When Mac data is present, mention desktop apps by name and minutes in the summary; do not fold desktop minutes into categories or themes.
${observationRule}
- If a domain has a "Pattern:" note, mention possible testing, automation, or rapid lookups — never claim Claude, Codex, or Cursor initiated activity unless the person simply visited that product's website.
- Categories are broad ("Software Development", "Social Media", "Entertainment", "Research", "Communication", "Shopping", "News", "Productivity", "Finance", "Health", "Education", "Travel").
- Themes are specific clusters ("Learning React hooks", "Job searching").
- Percentages must sum to 100.
- "siteCategories" MUST include EVERY domain listed above, each mapped to its best-fit concrete category.
- CRITICAL: never use "Other", "Unknown", "Uncategorized", "Miscellaneous", "Misc", "N/A", or an empty value anywhere. For anything ambiguous, choose the closest real category. Every name and category must be a specific, human-meaningful label.
${goalRule}`;
}

function hasDesktopRule(desktopMerge) {
  return desktopMerge?.available;
}

function validateMacSummary(summary, desktopMerge) {
  if (!desktopMerge?.available || !summary) return true;

  const lower = summary.toLowerCase();
  const mentionsMac =
    lower.includes("on your mac") ||
    lower.includes("your mac") ||
    lower.includes("on the mac") ||
    lower.includes("on this mac");

  if (mentionsMac) return true;

  for (const app of desktopMerge.otherApps || []) {
    if (app.name && lower.includes(app.name.toLowerCase())) return true;
  }

  return false;
}

function buildMacSummaryPrefix(desktopMerge) {
  const presence = formatDuration(desktopMerge.devicePresenceSeconds || 0);
  const active = formatDuration(desktopMerge.deviceActiveSeconds || 0);

  const appNames = [];
  for (const app of (desktopMerge.otherApps || []).slice(0, 3)) {
    if (app.name) appNames.push(app.name);
  }
  if (desktopMerge.chromeApp) appNames.push("Chrome");

  const appsPhrase =
    appNames.length > 0
      ? `including time in ${appNames.slice(0, 3).join(", ")}`
      : "across your apps";

  return `You spent ${presence} on your Mac (${active} in use), ${appsPhrase}. `;
}

async function resolveDesktopPayload(dateStr, desktopPayload) {
  if (desktopPayload?.apps?.length) {
    return { payload: desktopPayload, fetchError: null };
  }

  try {
    const payload = await getDesktopDayMetricsForSummarize(dateStr);
    return { payload, fetchError: null };
  } catch (err) {
    return { payload: null, fetchError: err?.message || "Native host unavailable" };
  }
}

async function callModel(apiKey, prompt) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chrome-activity-analyzer",
      "X-Title": "Chrome Activity Analyzer",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
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

  return { parsed: normalize(extractJson(content)), usage: data.usage || null };
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

export async function analyzeDay(dateStr, options = {}) {
  const { apiKey, goals } = await getSettings();
  if (!apiKey) {
    throw new Error("No API key set. Add your OpenRouter key in the extension popup.");
  }

  const now = Date.now();
  const [metrics, history, desktopResolved] = await Promise.all([
    getDayMetrics(dateStr, now),
    getHistoryForDay(dateStr, now).catch(() => ({ available: false })),
    resolveDesktopPayload(dateStr, options.desktopPayload),
  ]);

  const desktopRaw = desktopResolved.payload;
  const desktopMerge = mergeDesktopWithChrome(metrics, desktopRaw);
  if (desktopResolved.fetchError && !desktopMerge.available) {
    desktopMerge.desktopFetchError = desktopResolved.fetchError;
  }

  const { sessions, domainHints, activeSeconds, openSeconds } = metrics;
  const hasDesktop = desktopMerge?.available;
  if (!sessions.length && openSeconds === 0 && !hasDesktop) {
    throw new Error("No tracked activity for this day yet.");
  }

  const entries = sessionsToHistoryEntries(sessions);
  const activeMinutes = Math.round(activeSeconds / 60);
  const openMinutes = Math.round(openSeconds / 60);
  const devicePresenceMinutes = Math.round((desktopMerge.devicePresenceSeconds || 0) / 60);
  const deviceActiveMinutes = Math.round((desktopMerge.deviceActiveSeconds || 0) / 60);
  const desktopAppCount = (desktopMerge.otherApps?.length || 0) + (desktopMerge.chromeApp ? 1 : 0);
  const lastEventTs = await getLastEventTsInDay(dateStr, now);
  const goalText = (goals || "").trim();
  const domainSummary = buildDomainSummary(entries, domainHints);
  const historyContext = buildHistoryContext(metrics, history, hasDesktop);

  const prompt = buildPrompt(
    dateStr,
    domainSummary,
    openMinutes,
    activeMinutes,
    goalText,
    historyContext,
    desktopMerge,
    false
  );

  let { parsed, usage } = await callModel(apiKey, prompt);

  if (hasDesktop && !validateMacSummary(parsed.summary, desktopMerge)) {
    const retryPrompt = buildPrompt(
      dateStr,
      domainSummary,
      openMinutes,
      activeMinutes,
      goalText,
      historyContext,
      desktopMerge,
      true
    );
    const retry = await callModel(apiKey, retryPrompt);
    parsed = retry.parsed;
    usage = retry.usage;
  }

  if (hasDesktop && !validateMacSummary(parsed.summary, desktopMerge)) {
    parsed.summary = buildMacSummaryPrefix(desktopMerge) + parsed.summary;
  }

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
    includedDesktop: hasDesktop,
    devicePresenceMinutes,
    deviceActiveMinutes,
    analyzedAt: new Date().toISOString(),
    activityFingerprint: {
      activeSeconds,
      openSeconds,
      lastEventTs,
      devicePresenceSeconds: desktopMerge.devicePresenceSeconds || 0,
      deviceActiveSeconds: desktopMerge.deviceActiveSeconds || 0,
      desktopAppCount,
    },
    model: DEFAULT_MODEL,
    usage,
    estimatedCostUsd: estimateCostUsd(usage),
  };

  await saveAnalysis(analysis);
  return analysis;
}
