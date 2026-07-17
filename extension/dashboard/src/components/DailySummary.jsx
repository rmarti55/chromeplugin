import { formatDuration } from "../../../db.js";
import { HINT_LABELS } from "../../../heuristics.js";

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
  topDomains,
  analyzedAt,
  estimatedCostUsd,
  historyAlignment,
}) {
  const lastSummarized = formatAnalyzedAt(analyzedAt);
  const showGap = openSeconds > 0 && activeSeconds > 0 && openSeconds > activeSeconds * 1.25;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
        <div className="text-right">
          <span className="text-sm text-slate-400 block">
            {formatDuration(openSeconds || 0)} Chrome open
          </span>
          <span className="text-xs text-slate-500 block">
            Active use: {formatDuration(activeSeconds || 0)}
          </span>
          {lastSummarized && (
            <span className="text-xs text-slate-500 block">Last summarized · {lastSummarized}</span>
          )}
          {estimatedCostUsd != null && estimatedCostUsd > 0 && (
            <span className="text-xs text-slate-600">
              Est. API cost · ${estimatedCostUsd < 0.01 ? estimatedCostUsd.toFixed(4) : estimatedCostUsd.toFixed(3)}
            </span>
          )}
        </div>
      </div>

      {showGap && (
        <p className="text-xs text-slate-500 mb-4">
          Chrome was open {formatDuration(openSeconds)}; {formatDuration(activeSeconds)} had recent
          input. Reading or time in other apps explains the gap.
        </p>
      )}

      {historyAlignment?.available && historyAlignment.summary && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          <span className="text-xs uppercase tracking-wide text-slate-500">History vs Mirror</span>
          <p className="text-sm text-slate-400 mt-1">{historyAlignment.summary}</p>
          {historyAlignment.trend && (
            <p className="text-xs text-slate-500 mt-2">{historyAlignment.trend}</p>
          )}
        </div>
      )}

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
          <h3 className="text-sm font-medium text-slate-400 mb-1">Top Sites</h3>
          <p className="text-xs text-slate-500 mb-3">
            Active use per site. Visits = navigations. Not Chrome History.
          </p>
          <div className="space-y-2">
            {topDomains.slice(0, 8).map((d) => {
              const badge =
                d.automationHint && d.automationHint !== "none"
                  ? HINT_LABELS[d.automationHint]
                  : null;
              return (
                <div key={d.domain} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <span className="text-slate-300 truncate">{d.domain}</span>
                    {badge && (
                      <span
                        className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/90 border border-amber-500/25"
                        title={d.hintNote || badge}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-slate-400">{d.visits} visits</span>
                    <span className="text-indigo-400 font-medium w-20 text-right tabular-nums">
                      {formatDuration(d.seconds ?? (d.minutes || 0) * 60)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
