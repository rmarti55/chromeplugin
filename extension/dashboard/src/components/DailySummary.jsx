import { formatDuration } from "../../../db.js";

function formatAnalyzedAt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DailySummary({
  summary,
  observation,
  goalAssessment,
  openSeconds,
  activeSeconds,
  analyzedAt,
  showClocks = true,
  desktop,
}) {
  const lastSummarized = formatAnalyzedAt(analyzedAt);

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
        <div className="text-right">
          {showClocks && (
            <>
              {desktop?.available ? (
                <>
                  <span className="text-sm text-slate-400 block">
                    {formatDuration(desktop.devicePresenceSeconds || 0)} device presence
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Chrome open: {formatDuration(openSeconds || 0)} · active:{" "}
                    {formatDuration(activeSeconds || 0)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm text-slate-400 block">
                    {formatDuration(openSeconds || 0)} Chrome open
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Active use: {formatDuration(activeSeconds || 0)}
                  </span>
                </>
              )}
            </>
          )}
          {lastSummarized && (
            <span className="text-xs text-slate-500 block">Last summarized · {lastSummarized}</span>
          )}
        </div>
      </div>

      {summary && <p className="text-slate-300 leading-relaxed mb-4">{summary}</p>}

      {observation && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          <span className="text-xs uppercase tracking-wide text-slate-500">Observation</span>
          <p className="text-slate-300 mt-1">{observation}</p>
        </div>
      )}

      {goalAssessment && (
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <span className="text-xs uppercase tracking-wide text-indigo-400">Against your goal</span>
          <p className="text-indigo-200 mt-1">{goalAssessment}</p>
        </div>
      )}
    </div>
  );
}
