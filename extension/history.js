// Read-only Chrome History for alignment with the event log.
// History records visit timestamps; dwell is estimated from gaps between visits.

import { dayBounds } from "./db.js";

const ALIGN_RATIO = 2;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_DWELL_MS = 30 * 60 * 1000;

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

function historySearch(start, endTs) {
  return new Promise((resolve, reject) => {
    chrome.history.search(
      { text: "", startTime: start, endTime: endTs, maxResults: 10000 },
      (results) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(results || []);
      }
    );
  });
}

function historyGetVisits(url) {
  return new Promise((resolve, reject) => {
    chrome.history.getVisits({ url }, (visits) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(visits || []);
    });
  });
}

// Estimate dwell from visit timestamps: time until next visit (capped), zero if gap > session limit.
export function estimateDwellFromVisits(visits, dayEndTs) {
  if (!visits.length) return { totalSeconds: 0, byDomain: new Map() };

  const sorted = [...visits].sort((a, b) => a.visitTime - b.visitTime);
  const byDomain = new Map();
  let totalMs = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const nextTs = i < sorted.length - 1 ? sorted[i + 1].visitTime : dayEndTs;
    let gap = nextTs - cur.visitTime;
    if (gap > SESSION_GAP_MS) gap = 0;
    else gap = Math.min(gap, MAX_DWELL_MS);
    if (gap > 0) {
      totalMs += gap;
      byDomain.set(cur.domain, (byDomain.get(cur.domain) || 0) + gap / 1000);
    }
  }

  return { totalSeconds: Math.round(totalMs / 1000), byDomain };
}

export async function getHistoryForDay(dateStr, now = Date.now()) {
  if (typeof chrome === "undefined" || !chrome.history?.search) {
    return {
      domains: [],
      historyVisitCount: 0,
      historyDomainCount: 0,
      estimatedDwellSeconds: 0,
      available: false,
    };
  }

  const { start, end } = dayBounds(dateStr);
  const endTs = Math.min(end, now);

  const items = await historySearch(start, endTs);
  const urls = [...new Set(items.filter((i) => isWebUrl(i.url)).map((i) => i.url))];

  const dayVisits = [];
  const titleByUrl = new Map();
  for (const item of items) {
    if (item.url && item.title) titleByUrl.set(item.url, item.title);
  }

  // Fetch all visit records per URL (search only returns last visit per page).
  await Promise.all(
    urls.map(async (url) => {
      try {
        const visits = await historyGetVisits(url);
        const domain = hostFromUrl(url);
        if (!domain) return;
        for (const v of visits) {
          if (v.visitTime >= start && v.visitTime < endTs) {
            dayVisits.push({
              url,
              domain,
              visitTime: v.visitTime,
              transition: v.transition || "link",
            });
          }
        }
      } catch {
        /* skip bad URLs */
      }
    })
  );

  const byDomain = new Map();
  for (const v of dayVisits) {
    let d = byDomain.get(v.domain);
    if (!d) {
      d = {
        domain: v.domain,
        visits: 0,
        estimatedDwellSeconds: 0,
        lastVisitTs: 0,
        titles: [],
        transitions: {},
      };
      byDomain.set(v.domain, d);
    }
    d.visits += 1;
    if (v.visitTime > d.lastVisitTs) d.lastVisitTs = v.visitTime;
    const title = titleByUrl.get(v.url);
    if (title && !d.titles.includes(title) && d.titles.length < 5) {
      d.titles.push(title);
    }
    const tr = v.transition || "link";
    d.transitions[tr] = (d.transitions[tr] || 0) + 1;
  }

  const { totalSeconds, byDomain: dwellByDomain } = estimateDwellFromVisits(dayVisits, endTs);
  for (const [domain, secs] of dwellByDomain) {
    const d = byDomain.get(domain);
    if (d) d.estimatedDwellSeconds = Math.round(secs);
  }

  const domains = [...byDomain.values()].sort((a, b) => b.visits - a.visits);
  return {
    domains,
    historyVisitCount: dayVisits.length,
    historyDomainCount: domains.length,
    estimatedDwellSeconds: totalSeconds,
    available: true,
  };
}

function trendNote(history, metrics) {
  const hDwell = Math.round((history.estimatedDwellSeconds || 0) / 60);
  const openMin = Math.round((metrics.openSeconds || 0) / 60);
  const activeMin = Math.round((metrics.activeSeconds || 0) / 60);

  if (hDwell > activeMin * 1.5 && hDwell > openMin) {
    return "History gap-estimate is higher than Mirror — many short page loads.";
  }
  if (openMin > hDwell * 1.5 && openMin > activeMin) {
    return "Mirror Chrome open exceeds History gap-estimate — reading without many navigations.";
  }
  if (activeMin > 0 && hDwell > 0 && Math.abs(hDwell - activeMin) / activeMin < 0.35) {
    return "History gap-estimate and Mirror active use are in the same ballpark.";
  }
  return null;
}

export function compareDayToHistory(metrics, history) {
  if (!history?.available) {
    return { summary: null, trend: null, rows: [], available: false };
  }

  const mirrorByDomain = new Map();
  for (const d of metrics.openByDomain || []) {
    mirrorByDomain.set(d.domain, {
      activeSeconds: 0,
      openSeconds: d.seconds,
      visits: 0,
    });
  }
  for (const d of metrics.topDomains || []) {
    const m = mirrorByDomain.get(d.domain) || { activeSeconds: 0, openSeconds: 0, visits: 0 };
    m.activeSeconds = d.seconds;
    m.visits = d.visits;
    mirrorByDomain.set(d.domain, m);
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
    const historyDwell = h?.estimatedDwellSeconds || 0;
    const mirrorActive = m?.activeSeconds || 0;
    const mirrorOpen = m?.openSeconds || 0;
    const mirrorVisits = m?.visits || 0;

    if (historyVisits === 0 && mirrorActive === 0 && mirrorVisits === 0 && mirrorOpen === 0) {
      continue;
    }

    let alignment = "aligned";
    if (historyVisits > 0 && mirrorVisits > 0) {
      const ratio = Math.max(historyVisits, mirrorVisits) / Math.min(historyVisits, mirrorVisits);
      if (ratio >= ALIGN_RATIO) {
        alignment = historyVisits > mirrorVisits ? "mirror_low" : "history_low";
      }
    } else if (historyVisits > 0 && mirrorVisits === 0) {
      alignment = "mirror_low";
    } else if (mirrorVisits > 0 && historyVisits === 0) {
      alignment = "history_low";
    }

    if (historyDwell > mirrorActive * 2 && historyDwell > 60) {
      alignment = alignment === "aligned" ? "dwell_high" : alignment;
    }

    rows.push({
      domain,
      historyVisits,
      historyDwellSeconds: historyDwell,
      mirrorActiveSeconds: mirrorActive,
      mirrorOpenSeconds: mirrorOpen,
      mirrorVisits,
      alignment,
    });
  }

  rows.sort(
    (a, b) =>
      b.historyVisits - a.historyVisits ||
      b.historyDwellSeconds - a.historyDwellSeconds ||
      b.mirrorActiveSeconds - a.mirrorActiveSeconds
  );

  const openMin = Math.round((metrics.openSeconds || 0) / 60);
  const activeMin = Math.round((metrics.activeSeconds || 0) / 60);
  const hDwellMin = Math.round((history.estimatedDwellSeconds || 0) / 60);
  const summary = `History est. dwell ≈ ${hDwellMin}m (${history.historyVisitCount} visits) | Mirror Chrome open ${openMin}m | Active use ${activeMin}m | ${mirrorNavTotal} navigations.`;
  const trend = trendNote(history, metrics);

  return { summary, trend, rows, available: true };
}
