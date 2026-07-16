function fmt(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function SessionsList({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Where your time went</h2>
      <p className="text-xs text-slate-500 mb-4">Measured active time per page (idle time excluded).</p>
      <div className="space-y-2">
        {sessions.slice(0, 25).map((s) => (
          <div key={s.url} className="flex items-center justify-between text-sm gap-4">
            <div className="min-w-0">
              <div className="text-slate-200 truncate">{s.title || s.url}</div>
              <div className="text-slate-500 text-xs truncate">{s.domain}</div>
            </div>
            <span className="text-indigo-400 font-medium shrink-0 w-16 text-right">{fmt(s.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
