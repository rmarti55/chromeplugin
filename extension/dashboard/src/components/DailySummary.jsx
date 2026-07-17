function formatAnalyzedAt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DailySummary({ summary, analyzedAt, includedDesktop, desktop }) {
  const lastSummarized = formatAnalyzedAt(analyzedAt);
  const staleMacSummary = desktop?.available && includedDesktop !== true;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
        {lastSummarized && (
          <span className="text-xs text-slate-500 shrink-0">
            Last summarized · {lastSummarized}
          </span>
        )}
      </div>

      {staleMacSummary && (
        <p className="text-xs text-amber-400/90 mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          This summary was generated without Mac data — Re-summarize to include your full day.
        </p>
      )}

      {summary && <p className="text-slate-300 leading-relaxed">{summary}</p>}
    </div>
  );
}
