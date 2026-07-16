// Best-effort flags for rapid/automated browsing patterns derived from event shape.
// Never claims human vs agent identity — only "likely automated / rapid activity".

export const RAPID_RELOAD_COUNT = 5;
export const RAPID_RELOAD_WINDOW_MS = 30 * 1000;
export const BURST_NAV_COUNT = 8;
export const BURST_NAV_WINDOW_MS = 60 * 1000;
export const QUERY_CHURN_DISTINCT = 6;
export const QUERY_CHURN_WINDOW_MS = 60 * 1000;

export const HINT_LABELS = {
  none: null,
  rapid_reload: "Rapid reloads",
  query_churn: "Query churn",
  burst_navigation: "Burst navigation",
};

export const HINT_NOTES = {
  rapid_reload:
    "Likely automated or rapid reloads (HMR/testing)—visit noise filtered; time still counted while focused.",
  query_churn:
    "Many quick URL changes (e.g. Maps/search)—likely rapid lookups, not deep browsing.",
  burst_navigation:
    "Many navigations in a short burst—likely testing or automated browsing.",
};

function urlKey(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

// Collect urlchange events with a web URL from a day's event stream.
function navigationEvents(events) {
  return events.filter((ev) => ev.type === "urlchange" && ev.url && ev.domain);
}

// Count events in (ts - windowMs, ts] matching predicate.
function countInWindow(list, ts, windowMs, pred) {
  const lo = ts - windowMs;
  let n = 0;
  for (const item of list) {
    if (item.ts <= lo) continue;
    if (item.ts > ts) break;
    if (pred(item)) n += 1;
  }
  return n;
}

function distinctUrlsInWindow(list, ts, windowMs, domain) {
  const lo = ts - windowMs;
  const seen = new Set();
  for (const item of list) {
    if (item.ts <= lo) continue;
    if (item.ts > ts) break;
    if (item.domain === domain) seen.add(item.url);
  }
  return seen.size;
}

function detectDomainHint(domain, navs) {
  const domainNavs = navs.filter((n) => n.domain === domain);
  if (domainNavs.length < RAPID_RELOAD_COUNT) {
    // Still check churn/burst with lower bar if we have enough total navs
  }

  for (const nav of domainNavs) {
    const key = urlKey(nav.url);
    const sameUrlCount = countInWindow(
      domainNavs,
      nav.ts,
      RAPID_RELOAD_WINDOW_MS,
      (n) => urlKey(n.url) === key
    );
    if (sameUrlCount >= RAPID_RELOAD_COUNT) {
      return {
        automationHint: "rapid_reload",
        hintNote: HINT_NOTES.rapid_reload,
      };
    }
  }

  for (const nav of domainNavs) {
    const distinct = distinctUrlsInWindow(domainNavs, nav.ts, QUERY_CHURN_WINDOW_MS, domain);
    if (distinct >= QUERY_CHURN_DISTINCT) {
      return {
        automationHint: "query_churn",
        hintNote: HINT_NOTES.query_churn,
      };
    }
  }

  for (const nav of domainNavs) {
    const burstCount = countInWindow(
      domainNavs,
      nav.ts,
      BURST_NAV_WINDOW_MS,
      (n) => n.domain === domain
    );
    if (burstCount >= BURST_NAV_COUNT) {
      return {
        automationHint: "burst_navigation",
        hintNote: HINT_NOTES.burst_navigation,
      };
    }
  }

  return { automationHint: "none", hintNote: null };
}

// Returns Map<domain, { automationHint, hintNote }>.
export function computeDomainHints(events) {
  const navs = navigationEvents(events);
  const domains = [...new Set(navs.map((n) => n.domain))];
  const hints = new Map();
  for (const domain of domains) {
    hints.set(domain, detectDomainHint(domain, navs));
  }
  return hints;
}

// Object form for easy lookup in aggregateByDomain / AI prompt.
export function domainHintsToObject(hintsMap) {
  const out = {};
  for (const [domain, hint] of hintsMap) {
    out[domain] = hint;
  }
  return out;
}
