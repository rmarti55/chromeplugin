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
};

// Strip a leading "www." and lowercase.
function normalize(domain) {
  return (domain || "").toLowerCase().replace(/^www\./, "");
}

// Longest matching registrable-ish suffix wins, so "mail.google.com" beats
// "google.com" and "foo.github.com" still maps to github.com's category.
export function categorize(domain) {
  const host = normalize(domain);
  if (!host) return "Other";

  // exact
  if (DOMAIN_RULES[host]) return DOMAIN_RULES[host];

  // suffix match, preferring the most specific (longest) rule key
  let best = null;
  for (const key of Object.keys(DOMAIN_RULES)) {
    if (host === key || host.endsWith("." + key)) {
      if (!best || key.length > best.length) best = key;
    }
  }
  return best ? DOMAIN_RULES[best] : "Other";
}

// Turn measured sessions into CategoryBreakdown[] { name, minutes, percentage }.
export function categorizeSessions(sessions) {
  const byCat = new Map();
  let totalSeconds = 0;
  for (const s of sessions) {
    const cat = categorize(s.domain);
    byCat.set(cat, (byCat.get(cat) || 0) + s.seconds);
    totalSeconds += s.seconds;
  }
  if (totalSeconds === 0) return [];
  return [...byCat.entries()]
    .map(([name, seconds]) => ({
      name,
      minutes: Math.round(seconds / 60),
      percentage: Math.round((seconds / totalSeconds) * 100),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}
