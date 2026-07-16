import { formatDuration } from "../../../db.js";
import { categorize } from "../../../categorize.js";

export function SessionsList({ sessions, categoryCache }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Where your time went</h2>
      <p className="text-xs text-slate-500 mb-4">Measured active time per page (idle time excluded).</p>
      <div className="space-y-2">
        {sessions.slice(0, 25).map((s) => (
          <div key={s.url} className="flex items-center justify-between text-sm gap-4">
            <div className="min-w-0">
              <div className="text-slate-200 truncate">{s.title || s.domain || s.url}</div>
              <div className="text-slate-500 text-xs truncate">
                {s.domain} · {categorize(s.domain, categoryCache)}
              </div>
            </div>
            <span className="text-indigo-400 font-medium shrink-0 w-20 text-right tabular-nums">
              {formatDuration(s.seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
