const THEME_COLORS = [
  "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
];

export function ThemeList({ themes }) {
  if (!themes || themes.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Themes</h2>
      <div className="space-y-3">
        {themes.map((theme, i) => (
          <div key={i} className={`p-4 rounded-lg border ${THEME_COLORS[i % THEME_COLORS.length]}`}>
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
