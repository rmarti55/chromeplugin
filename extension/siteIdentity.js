// Friendly site names and SPA visit keys for single-page apps.
// Tier A (pathname): hash-only churn — Gmail, Slack, Google Workspace, etc.
// Tier B (origin): dashboard SPAs — App Store Connect, Vercel, localhost, etc.
// Label-only: friendly name without collapsing nav counts — GitHub, X, etc.

export const SITE_LABELS = {
  // Communication / productivity (Tier A pathname)
  "mail.google.com": "Gmail",
  "gmail.com": "Gmail",
  "outlook.live.com": "Outlook",
  "outlook.office.com": "Outlook",
  "outlook.office365.com": "Outlook",
  "slack.com": "Slack",
  "discord.com": "Discord",
  "notion.so": "Notion",
  "docs.google.com": "Google Docs",
  "drive.google.com": "Google Drive",
  "sheets.google.com": "Google Sheets",
  "calendar.google.com": "Google Calendar",

  // Dashboard SPAs (Tier B origin)
  "appstoreconnect.apple.com": "App Store Connect",
  "localhost": "Local dev",
  "vercel.com": "Vercel",
  "claude.ai": "Claude",
  "console.cloud.google.com": "Google Cloud",
  "console.aws.amazon.com": "AWS Console",
  "platform.openai.com": "OpenAI Platform",
  "console.anthropic.com": "Anthropic Console",
  "linear.app": "Linear",
  "figma.com": "Figma",

  // Label only (full-URL nav counting)
  "github.com": "GitHub",
  "developer.apple.com": "Apple Developer",
  "x.com": "X",
  "search.google.com": "Google Search",
};

/** Hash / in-app URL churn — collapse visits to origin + pathname. */
const SPA_PATHNAME_DOMAINS = new Set([
  "mail.google.com",
  "gmail.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "slack.com",
  "discord.com",
  "notion.so",
  "docs.google.com",
  "drive.google.com",
  "sheets.google.com",
  "calendar.google.com",
]);

/** Dashboard SPAs — collapse visits to origin until blur/idle/lock. */
const SPA_ORIGIN_DOMAINS = new Set([
  "appstoreconnect.apple.com",
  "localhost",
  "vercel.com",
  "claude.ai",
  "console.cloud.google.com",
  "console.aws.amazon.com",
  "platform.openai.com",
  "console.anthropic.com",
  "linear.app",
  "figma.com",
]);

function normalizeDomain(domain) {
  if (!domain) return "";
  return String(domain).toLowerCase().replace(/^www\./, "");
}

/** Friendly product name for a domain, or null if unknown. */
export function siteLabel(domain) {
  return SITE_LABELS[normalizeDomain(domain)] ?? null;
}

export function isPathnameSpaDomain(domain) {
  return SPA_PATHNAME_DOMAINS.has(normalizeDomain(domain));
}

export function isOriginSpaDomain(domain) {
  return SPA_ORIGIN_DOMAINS.has(normalizeDomain(domain));
}

/** Domains where visit counting uses a collapsed key (not full URL). */
export function isSpaDomain(domain) {
  const host = normalizeDomain(domain);
  return SPA_PATHNAME_DOMAINS.has(host) || SPA_ORIGIN_DOMAINS.has(host);
}

/** Primary label for Sites list / AI — product name beats a single page title. */
export function displayLabel(domain, fallbackTitle) {
  const label = siteLabel(domain);
  if (label) return label;
  if (fallbackTitle) return fallbackTitle;
  return domain;
}

/** Secondary subtitle when the friendly label hides the longest-dwell page title. */
export function pageContextSubtitle(domain, pageTitle) {
  const label = siteLabel(domain);
  if (!label || !pageTitle) return null;
  const t = pageTitle.trim();
  if (!t || t === label) return null;
  return t;
}

/** Visit dedup key: full URL, origin+pathname (hash SPAs), or origin (dashboard SPAs). */
export function visitKey(url, domain) {
  const host = normalizeDomain(domain);
  try {
    const u = new URL(url);
    if (SPA_ORIGIN_DOMAINS.has(host)) return u.origin;
    if (SPA_PATHNAME_DOMAINS.has(host)) return `${u.origin}${u.pathname}`;
  } catch {
    // fall through
  }
  return url;
}
