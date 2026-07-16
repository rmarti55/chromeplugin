import { formatDuration } from "../../../db.js";

export function DailySummary({ summary, observation, goalAssessment, totalSeconds, topDomains }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
        <span className="text-sm text-slate-400">{formatDuration(totalSeconds || 0)} total</span>
      </div>

      {summary && <p className="text-slate-300 leading-relaxed mb-4">{summary}</p>}

      {observation && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          <span className="text-xs uppercase tracking-wide text-slate-500">Observation</span>
          <p className="text-slate-300 mt-1">{observation}</p>
        </div>
      )}

      {goalAssessment && (
        <div className="mb-6 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <span className="text-xs uppercase tracking-wide text-indigo-400">Against your goal</span>
          <p className="text-indigo-200 mt-1">{goalAssessment}</p>
        </div>
      )}

      {topDomains && topDomains.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Top Sites</h3>
          <div className="space-y-2">
            {topDomains.slice(0, 8).map((d) => (
              <div key={d.domain} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 truncate mr-4">{d.domain}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400">{d.visits} visits</span>
                  <span className="text-indigo-400 font-medium w-20 text-right tabular-nums">
                    {formatDuration(d.seconds ?? (d.minutes || 0) * 60)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
