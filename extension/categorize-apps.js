// Local bundle-id → category buckets for desktop apps (parallel to categorize.js).

const BUNDLE_RULES = {
  "com.tinyspeck.slackmacgap": "Communication",
  "com.hnc.Discord": "Communication",
  "com.apple.MobileSMS": "Communication",
  "com.apple.mail": "Communication",
  "com.microsoft.teams2": "Communication",
  "com.microsoft.teams": "Communication",
  "us.zoom.xos": "Communication",
  "com.todesktop.230313mzl4w4u92": "Software Development",
  "com.microsoft.VSCode": "Software Development",
  "com.apple.dt.Xcode": "Software Development",
  "com.googlecode.iterm2": "Software Development",
  "dev.warp.Warp-Stable": "Software Development",
  "com.github.GitHubClient": "Software Development",
  "com.figma.Desktop": "Productivity",
  "notion.id": "Productivity",
  "com.apple.Notes": "Productivity",
  "com.apple.iCal": "Productivity",
  "com.apple.finder": "Productivity",
  "com.spotify.client": "Entertainment",
  "tv.twitch.studio": "Entertainment",
  "com.apple.Music": "Entertainment",
};

const PREFIX_RULES = [["com.apple.", "Productivity"]];

function categoryForBundle(bundleId) {
  if (BUNDLE_RULES[bundleId]) return BUNDLE_RULES[bundleId];
  for (const [prefix, cat] of PREFIX_RULES) {
    if (bundleId.startsWith(prefix)) return cat;
  }
  return "Productivity";
}

export function categorizeApps(apps) {
  const totals = new Map();
  for (const app of apps) {
    const cat = categoryForBundle(app.bundleId);
    totals.set(cat, (totals.get(cat) || 0) + (app.activeSeconds || 0));
  }
  const total = [...totals.values()].reduce((s, n) => s + n, 0);
  if (!total) return [];
  return [...totals.entries()]
    .map(([name, seconds]) => ({
      name,
      seconds,
      minutes: Math.round(seconds / 60),
      percentage: Math.round((seconds / total) * 100),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function mergeCategories(chromeCategories, desktopCategories) {
  const map = new Map();
  for (const c of chromeCategories || []) {
    map.set(c.name, (map.get(c.name) || 0) + (c.seconds ?? c.minutes * 60));
  }
  for (const c of desktopCategories || []) {
    map.set(c.name, (map.get(c.name) || 0) + (c.seconds ?? c.minutes * 60));
  }
  const total = [...map.values()].reduce((s, n) => s + n, 0);
  if (!total) return chromeCategories || [];
  return [...map.entries()]
    .map(([name, seconds]) => ({
      name,
      seconds,
      minutes: Math.round(seconds / 60),
      percentage: Math.round((seconds / total) * 100),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}
