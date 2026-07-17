// Homepage / new-tab landing noise — not meaningful activity.

const NOISE_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "duckduckgo.com",
  "www.duckduckgo.com",
  "search.yahoo.com",
]);

/** Chrome history transition strings that often mean new tab / start page. */
const NOISE_TRANSITIONS = new Set(["start_page", "auto_toplevel", "generated"]);

export function isHomepageNoiseUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!NOISE_HOSTS.has(u.hostname) && !NOISE_HOSTS.has(host)) return false;
    const path = u.pathname.replace(/\/$/, "") || "/";
    if (path !== "/" && path !== "/webhp") return false;
    if (u.search && u.search.length > 1) return false;
    return true;
  } catch {
    return false;
  }
}

export function isNoiseDomain(domain, { mirrorActiveSeconds = 0, mirrorVisits = 0, historyVisits = 0 } = {}) {
  if (!domain || !NOISE_HOSTS.has(domain.replace(/^www\./, ""))) return false;
  if (mirrorActiveSeconds >= 60) return false;
  if (mirrorVisits > 0 && mirrorActiveSeconds >= 30) return false;
  return historyVisits >= 3 || (mirrorVisits >= 3 && mirrorActiveSeconds < 20);
}

/** Roll noise domains into a single synthetic row for display. */
export function rollupNoiseRows(rows) {
  const kept = [];
  let noiseDomains = 0;
  let noiseHistVisits = 0;
  let noiseMirrorNavs = 0;

  for (const row of rows) {
    if (
      isNoiseDomain(row.domain, {
        mirrorActiveSeconds: row.mirrorActiveSeconds,
        mirrorVisits: row.mirrorVisits,
        historyVisits: row.historyVisits,
      })
    ) {
      noiseDomains += 1;
      noiseHistVisits += row.historyVisits || 0;
      noiseMirrorNavs += row.mirrorVisits || 0;
    } else {
      kept.push(row);
    }
  }

  const noiseRow =
    noiseDomains > 0
      ? {
          domain: "__new_tab_noise__",
          label: "New tab / homepage landings",
          historyVisits: noiseHistVisits,
          historyDwellSeconds: 0,
          mirrorActiveSeconds: 0,
          mirrorOpenSeconds: 0,
          mirrorVisits: noiseMirrorNavs,
          alignment: "noise",
          isNoiseRollup: true,
        }
      : null;

  return { rows: kept, noiseRow };
}

export { NOISE_TRANSITIONS };
