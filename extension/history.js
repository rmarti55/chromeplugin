// Read-only Chrome History for alignment with the event log.
// History records visits; Mirror measures focused time. Neither replaces the other.

import { dayBounds } from "./db.js";

const DEDUPE_MS = 30 * 1000;
const ALIGN_RATIO = 2;

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isWebUrl(url) {
  return url && (url.startsWith("http://") || url.startsWith("https://"));
}

export async function getHistoryForDay(dateStr, now = Date.now()) {
  if (typeof chrome === "undefined" || !chrome.history?.search) {
    return {
      domains: [],
      historyVisitCount: 0,
      historyDomainCount: 0,
      available: false,
    };
  }

  const { start, end } = dayBounds(dateStr);
  const endTs = Math.min(end, now);

  const items = await new Promise((resolve, reject) => {
    chrome.history.search(
      { text: "", startTime: start, endTime: endTs, maxResults: 10000 },
      (results) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(results || []);
      }
    );
  });

  const byDomain = new Map();
  let historyVisitCount = 0;
  const lastVisitByUrl = new Map();

  const sorted = [...items]
    .filter((i) => isWebUrl(i.url))
    .sort((a, b) => a.lastVisitTime - b.lastVisitTime);

  for (const item of sorted) {
    const domain = hostFromUrl(item.url);
    if (!domain) continue;

    const last = lastVisitByUrl.get(item.url);
    if (last && item.lastVisitTime - last < DEDUPE_MS) continue;
    lastVisitByUrl.set(item.url, item.lastVisitTime);

    historyVisitCount += 1;
    let d = byDomain.get(domain);
    if (!d) {
      d = { domain, visits: 0, lastVisitTs: 0, titles: [] };
      byDomain.set(domain, d);
    }
    d.visits += 1;
    if (item.lastVisitTime > d.lastVisitTs) d.lastVisitTs = item.lastVisitTime;
    if (item.title && !d.titles.includes(item.title) && d.titles.length < 5) {
      d.titles.push(item.title);
    }
  }

  const domains = [...byDomain.values()].sort((a, b) => b.visits - a.visits);
  return {
    domains,
    historyVisitCount,
    historyDomainCount: domains.length,
    available: true,
  };
}

export function compareDayToHistory(metrics, history) {
  if (!history?.available) {
    return { summary: null, rows: [], available: false };
  }

  const mirrorByDomain = new Map();
  for (const d of metrics.topDomains || []) {
    mirrorByDomain.set(d.domain, { activeSeconds: d.seconds, visits: d.visits });
  }

  const allDomains = new Set([
    ...mirrorByDomain.keys(),
    ...(history.domains || []).map((d) => d.domain),
  ]);

  const mirrorNavTotal = (metrics.topDomains || []).reduce((s, d) => s + d.visits, 0);
  const rows = [];

  for (const domain of allDomains) {
    const h = history.domains.find((x) => x.domain === domain);
    const m = mirrorByDomain.get(domain);
    const historyVisits = h?.visits || 0;
    const mirrorActive = m?.activeSeconds || 0;
    const mirrorVisits = m?.visits || 0;

    if (historyVisits === 0 && mirrorActive === 0 && mirrorVisits === 0) continue;

    let alignment = "aligned";
    if (historyVisits === 0 && mirrorVisits > 0) {
      alignment = "history_low";
    } else if (mirrorVisits === 0 && historyVisits > 0) {
      alignment = "mirror_low";
    } else if (historyVisits > 0 && mirrorVisits > 0) {
      const ratio = Math.max(historyVisits, mirrorVisits) / Math.min(historyVisits, mirrorVisits);
      if (ratio >= ALIGN_RATIO) {
        alignment = historyVisits > mirrorVisits ? "mirror_low" : "history_low";
      }
    }

    rows.push({
      domain,
      historyVisits,
      mirrorActiveSeconds: mirrorActive,
      mirrorVisits,
      alignment,
    });
  }

  rows.sort(
    (a, b) => b.historyVisits - a.historyVisits || b.mirrorActiveSeconds - a.mirrorActiveSeconds
  );

  const openMin = Math.round((metrics.openSeconds || 0) / 60);
  const activeMin = Math.round((metrics.activeSeconds || 0) / 60);
  const summary = `History logged ${history.historyVisitCount} visits across ${history.historyDomainCount} sites; Mirror tracked ${openMin}m Chrome open, ${activeMin}m active use, and ${mirrorNavTotal} navigations.`;

  return { summary, rows, available: true };
}
