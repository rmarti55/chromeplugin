import { DayClocks } from "./DayClocks.jsx";

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
  includedDesktop,
  showClocks = true,
  desktop,
}) {
  const lastSummarized = formatAnalyzedAt(analyzedAt);
  const staleMacSummary = desktop?.available && includedDesktop !== true;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
        <div>
          {showClocks && (
            <DayClocks
              openSeconds={openSeconds}
              activeSeconds={activeSeconds}
              desktop={desktop}
              layout="inline"
            />
          )}
          {lastSummarized && (
            <span className="text-xs text-slate-500 block mt-1 text-right">
              Last summarized · {lastSummarized}
            </span>
          )}
        </div>
      </div>

      {staleMacSummary && (
        <p className="text-xs text-amber-400/90 mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          This summary was generated without Mac data — Re-summarize to include your full day.
        </p>
      )}

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
