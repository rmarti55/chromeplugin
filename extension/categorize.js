// Cheap, local, domain-based categorization. Runs with zero AI/network cost so
// the dashboard can show categorized time immediately. The daily AI summary can
// later refine ambiguous domains, but this is the always-available baseline.

// Order matters only for readability; matching is longest-suffix wins.
const DOMAIN_RULES = {
  // Software / Development
  "github.com": "Software Development",
  "gitlab.com": "Software Development",
  "stackoverflow.com": "Software Development",
  "stackexchange.com": "Software Development",
  "npmjs.com": "Software Development",
  "developer.mozilla.org": "Software Development",
  "vercel.com": "Software Development",
  "localhost": "Software Development",
  "codepen.io": "Software Development",
  "replit.com": "Software Development",
  "huggingface.co": "Software Development",

  // Social Media
  "twitter.com": "Social Media",
  "x.com": "Social Media",
  "reddit.com": "Social Media",
  "facebook.com": "Social Media",
  "instagram.com": "Social Media",
  "linkedin.com": "Social Media",
  "tiktok.com": "Social Media",
  "threads.net": "Social Media",
  "bsky.app": "Social Media",

  // Entertainment
  "youtube.com": "Entertainment",
  "netflix.com": "Entertainment",
  "twitch.tv": "Entertainment",
  "spotify.com": "Entertainment",
  "hulu.com": "Entertainment",
  "disneyplus.com": "Entertainment",

  // Communication
  "mail.google.com": "Communication",
  "gmail.com": "Communication",
  "outlook.com": "Communication",
  "slack.com": "Communication",
  "discord.com": "Communication",
  "web.whatsapp.com": "Communication",
  "messenger.com": "Communication",
  "zoom.us": "Communication",

  // Research / Reference
  "google.com": "Research",
  "wikipedia.org": "Research",
  "scholar.google.com": "Research",
  "arxiv.org": "Research",
  "medium.com": "Research",
  "notion.so": "Productivity",
  "docs.google.com": "Productivity",
  "figma.com": "Productivity",
  "chatgpt.com": "Research",
  "claude.ai": "Research",
  "perplexity.ai": "Research",

  // News
  "nytimes.com": "News",
  "bbc.com": "News",
  "bbc.co.uk": "News",
  "theguardian.com": "News",
  "cnn.com": "News",
  "washingtonpost.com": "News",
  "news.ycombinator.com": "News",

  // Shopping
  "amazon.com": "Shopping",
  "ebay.com": "Shopping",
  "etsy.com": "Shopping",
  "walmart.com": "Shopping",
  "aliexpress.com": "Shopping",
  "target.com": "Shopping",
  "bestbuy.com": "Shopping",
  "shopify.com": "Shopping",

  // More Software / Development
  "vercel.app": "Software Development",
  "netlify.app": "Software Development",
  "railway.app": "Software Development",
  "render.com": "Software Development",
  "cloudflare.com": "Software Development",
  "console.cloud.google.com": "Software Development",
  "aws.amazon.com": "Software Development",
  "console.aws.amazon.com": "Software Development",
  "openrouter.ai": "Software Development",
  "platform.openai.com": "Software Development",
  "console.anthropic.com": "Software Development",
  "pypi.org": "Software Development",
  "readthedocs.io": "Software Development",
  "vitejs.dev": "Software Development",
  "react.dev": "Software Development",

  // More Productivity
  "linear.app": "Productivity",
  "asana.com": "Productivity",
  "trello.com": "Productivity",
  "calendar.google.com": "Productivity",
  "drive.google.com": "Productivity",
  "sheets.google.com": "Productivity",
  "airtable.com": "Productivity",
  "canva.com": "Productivity",

  // More Entertainment / Communication / News
  "music.youtube.com": "Entertainment",
  "soundcloud.com": "Entertainment",
  "primevideo.com": "Entertainment",
  "max.com": "Entertainment",
  "teams.microsoft.com": "Communication",
  "meet.google.com": "Communication",
  "telegram.org": "Communication",
  "web.telegram.org": "Communication",
  "theverge.com": "News",
  "techcrunch.com": "News",
  "arstechnica.com": "News",
  "bloomberg.com": "News",
  "wsj.com": "News",
};

// If no domain rule matches, infer a concrete category from keywords in the
// hostname so we still return a real label — never "Other"/"Unknown".
const KEYWORD_RULES = [
  [/(^|\.)(shop|store|cart|buy|checkout)/, "Shopping"],
  [/(^|\.)(news|times|post|tribune|herald|gazette)/, "News"],
  [/(^|\.)(mail|inbox|chat|messenger)/, "Communication"],
  [/(^|\.)(docs?|dev|api|git|code|cloud|app)\./, "Software Development"],
  [/(^|\.)(blog|medium|substack)/, "Research"],
  [/(^|\.)(video|tv|stream|watch|play|music)/, "Entertainment"],
];

// Ultimate fallback — a real, concrete bucket (not "Other"/"Unknown"/empty).
const FALLBACK_CATEGORY = "General Browsing";

// Strip a leading "www." and lowercase.
function normalize(domain) {
  return (domain || "").toLowerCase().replace(/^www\./, "");
}

// Longest matching registrable-ish suffix wins, so "mail.google.com" beats
// "google.com" and "foo.github.com" still maps to github.com's category.
// Resolve a domain to a concrete category. Never returns Other/Unknown/empty.
// `cache` is an optional domain→category map learned from the AI (source of
// truth for previously-seen domains).
export function categorize(domain, cache) {
  const host = normalize(domain);
  if (!host) return FALLBACK_CATEGORY;

  // 1. AI-learned category for this exact domain
  if (cache && cache[host]) return cache[host];

  // 2. exact rule
  if (DOMAIN_RULES[host]) return DOMAIN_RULES[host];

  // 3. suffix match, preferring the most specific (longest) rule key
  let best = null;
  for (const key of Object.keys(DOMAIN_RULES)) {
    if (host === key || host.endsWith("." + key)) {
      if (!best || key.length > best.length) best = key;
    }
  }
  if (best) return DOMAIN_RULES[best];

  // 4. keyword inference from the hostname
  for (const [re, cat] of KEYWORD_RULES) {
    if (re.test(host)) return cat;
  }

  // 5. concrete fallback (never Other/Unknown/empty)
  return FALLBACK_CATEGORY;
}

// Turn measured sessions into CategoryBreakdown[] { name, seconds, minutes, percentage }.
// `cache` is the optional AI-learned domain→category map.
export function categorizeSessions(sessions, cache) {
  const byCat = new Map();
  let totalSeconds = 0;
  for (const s of sessions) {
    const cat = categorize(s.domain, cache);
    byCat.set(cat, (byCat.get(cat) || 0) + s.seconds);
    totalSeconds += s.seconds;
  }
  if (totalSeconds === 0) return [];
  return [...byCat.entries()]
    .map(([name, seconds]) => ({
      name,
      seconds,
      minutes: Math.round(seconds / 60),
      percentage: Math.round((seconds / totalSeconds) * 100),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}
