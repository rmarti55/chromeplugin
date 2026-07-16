#!/usr/bin/env node
/**
 * Benchmark OpenRouter models for Daily Mirror JSON summaries.
 * Usage: OPENROUTER_API_KEY=sk-or-... node scripts/benchmark-models.mjs
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = ["google/gemini-2.5-flash-lite"];

// Representative 2026-07-16 activity (from dogfooding session).
const SAMPLE = {
  date: "2026-07-16",
  openMinutes: 28,
  activeMinutes: 21,
  goalText: "Basic tracking of my chrome activity",
  domainSummary: `- chatgpt.com: 5 min active use
  Pages: ChatGPT, Token Expired Fix, Codex Pricing
- localhost: 3 min active use
  Pages: Santa Fe Minutes, LiveIntel
- google.com: 3 min active use
  Pages: Google Maps
- vercel.com: 3 min active use
  Pages: santa-fe-minutes - Overview, New Project
- claude.ai: 2 min active use
  Pages: Unidentified object inquiry - Claude
- search.google.com: 1 min active use
  Pages: Welcome to Google Search Console
- learn.chatgpt.com: 1 min active use
  Pages: Codex CLI | ChatGPT Learn
- santafeminutes.space: 1 min active use
  Pages: People Directory, Santa Fe Minutes
- openrouter.ai: 1 min active use
  Pages: API Keys | Settings
- x.com: 1 min active use
  Pages: Tibo (@thsottiaux) / X`,
  domains: [
    "chatgpt.com",
    "localhost",
    "google.com",
    "vercel.com",
    "claude.ai",
    "search.google.com",
    "learn.chatgpt.com",
    "santafeminutes.space",
    "openrouter.ai",
    "x.com",
  ],
};

const BANNED = /^(other|others|unknown|uncategori[sz]ed|misc(ellaneous)?|n\/?a|none|general|tbd|\?+)?$/i;

function buildPrompt() {
  const { date, domainSummary, openMinutes, activeMinutes, goalText } = SAMPLE;
  return `You are a calm, honest mirror for how someone spent their day online. This is for the person themselves — not a manager. Be specific and kind but do not flatter.

Browsing activity for ${date} (NOT Chrome History):
${domainSummary}

Chrome open: ${openMinutes} minutes (Chrome was the focused app)
Active use: ${activeMinutes} minutes (Chrome focused + recent mouse/keyboard input)

The person wrote down what they were trying to do:
"${goalText}"

Respond with ONLY valid JSON in this exact format:
{
  "summary": "A 3-4 sentence narrative of how the day was spent, in second person ('you').",
  "observation": "One honest, non-judgmental observation about a pattern in the day.",
  "goalAssessment": "one honest sentence comparing the stated goal to how the time was actually spent",
  "categories": [ { "name": "Category Name", "minutes": 120, "percentage": 30 } ],
  "themes": [ { "name": "Theme description", "sites": ["domain1.com"], "minutes": 60 } ],
  "siteCategories": [ { "domain": "domain1.com", "category": "Category Name" } ]
}

Rules:
- Category and theme minutes must reflect ACTIVE USE only and sum to ${activeMinutes}.
- Percentages must sum to 100.
- "siteCategories" MUST include EVERY domain listed above.
- CRITICAL: never use "Other", "Unknown", "Uncategorized", or empty category names.`;
}

function scoreResponse(model, content, usage) {
  const result = {
    model,
    parseOk: false,
    bannedCategories: 0,
    siteCoverage: 0,
    categoryMinuteSum: 0,
    summaryWords: 0,
    mentionsDomain: false,
    usage,
    error: null,
  };
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    const parsed = JSON.parse(match[0]);
    result.parseOk = true;
    result.summaryWords = (parsed.summary || "").split(/\s+/).filter(Boolean).length;
    result.mentionsDomain = SAMPLE.domains.some((d) =>
      (parsed.summary || "").toLowerCase().includes(d.replace(/^www\./, ""))
    );
    const cats = parsed.categories || [];
    result.categoryMinuteSum = cats.reduce((s, c) => s + (c.minutes || 0), 0);
    result.bannedCategories = cats.filter((c) => BANNED.test(String(c.name || "").trim())).length;
    const mapped = new Set(
      (parsed.siteCategories || []).map((sc) =>
        String(sc.domain || "").toLowerCase().replace(/^www\./, "")
      )
    );
    result.siteCoverage = SAMPLE.domains.filter((d) => mapped.has(d)).length;
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

async function callModel(model, apiKey, prompt) {
  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/chrome-activity-analyzer",
      "X-Title": "Daily Mirror benchmark",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: data.usage,
  };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Set OPENROUTER_API_KEY");
    process.exit(1);
  }
  const prompt = buildPrompt();
  const results = [];
  for (const model of MODELS) {
    process.stdout.write(`Calling ${model}... `);
    try {
      const { content, usage } = await callModel(model, apiKey, prompt);
      const scored = scoreResponse(model, content, usage);
      results.push(scored);
      console.log(scored.parseOk ? "ok" : "FAIL", usage ? `(${usage.prompt_tokens}+${usage.completion_tokens} tok)` : "");
    } catch (e) {
      results.push({ model, error: e.message });
      console.log("ERROR", e.message);
    }
  }
  console.log("\n--- Results ---");
  console.table(
    results.map((r) => ({
      model: r.model,
      parseOk: r.parseOk ?? false,
      siteCoverage: r.siteCoverage != null ? `${r.siteCoverage}/${SAMPLE.domains.length}` : "-",
      catMinutes: r.categoryMinuteSum ?? "-",
      banned: r.bannedCategories ?? "-",
      summaryWords: r.summaryWords ?? "-",
      mentionsDomain: r.mentionsDomain ?? false,
      tokens: r.usage ? `${r.usage.prompt_tokens}+${r.usage.completion_tokens}` : "-",
      error: r.error || "",
    }))
  );
}

main();
