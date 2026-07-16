import { formatDuration } from "../../../db.js";
import { categorize } from "../../../categorize.js";
import { HINT_LABELS } from "../../../heuristics.js";

export function SessionsList({ sessions, categoryCache, domainHints = {} }) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Where your time went</h2>
      <p className="text-xs text-slate-500 mb-4">
        Active use per page (pauses after ~5 min without input). Chrome open shown when higher.
      </p>
      <div className="space-y-2">
        {sessions.slice(0, 25).map((s) => {
          const hint = domainHints[s.domain];
          const badge =
            hint?.automationHint && hint.automationHint !== "none"
              ? HINT_LABELS[hint.automationHint]
              : null;
          const showOpen = (s.openSeconds || 0) > (s.seconds || 0);
          return (
            <div key={s.url} className="flex items-center justify-between text-sm gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-slate-200 truncate">{s.title || s.domain || s.url}</div>
                  {badge && (
                    <span
                      className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/90 border border-amber-500/25"
                      title={hint.hintNote || badge}
                    >
                      {badge}
                    </span>
                  )}
                </div>
                <div className="text-slate-500 text-xs truncate">
                  {s.domain} · {categorize(s.domain, categoryCache)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-indigo-400 font-medium tabular-nums block">
                  {formatDuration(s.seconds || 0)}
                </span>
                {showOpen && (
                  <span className="text-sky-400/70 text-xs tabular-nums">
                    open {formatDuration(s.openSeconds)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
