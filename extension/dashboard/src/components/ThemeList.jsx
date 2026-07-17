const THEME_INTENSITY = [
  "bg-indigo-500/40 text-indigo-200 border-indigo-400/50",
  "bg-indigo-500/30 text-indigo-200 border-indigo-400/40",
  "bg-indigo-500/25 text-indigo-300 border-indigo-500/35",
  "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "bg-indigo-500/15 text-indigo-300/90 border-indigo-500/25",
  "bg-indigo-500/10 text-indigo-400/80 border-indigo-500/20",
];

function themeIntensityClass(minutes, maxMinutes) {
  if (maxMinutes <= 0) return THEME_INTENSITY[THEME_INTENSITY.length - 1];
  const ratio = minutes / maxMinutes;
  const step = Math.min(
    THEME_INTENSITY.length - 1,
    Math.floor((1 - ratio) * THEME_INTENSITY.length)
  );
  return THEME_INTENSITY[step];
}

export function ThemeList({ themes }) {
  if (!themes || themes.length === 0) return null;

  const sortedThemes = [...themes].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  const maxMinutes = Math.max(...sortedThemes.map((t) => t.minutes || 0));

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Themes</h2>
      <div className="space-y-3">
        {sortedThemes.map((theme, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg border ${themeIntensityClass(theme.minutes || 0, maxMinutes)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{theme.name}</span>
              <span className="text-sm opacity-75">{theme.minutes} min</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(theme.sites || []).map((site) => (
                <span key={site} className="text-xs px-2 py-0.5 rounded-full bg-black/20">
                  {site}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
