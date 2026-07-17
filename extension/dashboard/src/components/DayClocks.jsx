import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";

/** Mac-first day clocks when companion is connected; Chrome-only otherwise. */
export function DayClocks({ openSeconds, activeSeconds, desktop, layout = "stack" }) {
  const showMac = desktop?.available;

  if (showMac) {
    return (
      <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-2 text-right shrink-0"}>
        <div className="space-y-0.5" title={`${LABELS.tipOnMac} ${LABELS.tipUsingMac}`}>
          <div className="tabular-nums">
            <span className="text-indigo-400 font-semibold text-sm">
              {formatDuration(desktop.devicePresenceSeconds || 0)}
            </span>
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-slate-300 text-sm">{formatDuration(desktop.deviceActiveSeconds || 0)}</span>
          </div>
          <div className="text-xs text-slate-500">
            {LABELS.onMac} · {LABELS.usingMac}
          </div>
        </div>
        <div className="pt-1.5 border-t border-slate-700/50" title={LABELS.tipBrowsingChapter}>
          <div className="text-[10px] uppercase tracking-wide text-slate-600 mb-0.5">{LABELS.browsingChapter}</div>
          <div className="tabular-nums text-xs">
            <span className="text-slate-400">{formatDuration(openSeconds || 0)}</span>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-slate-500">{formatDuration(activeSeconds || 0)}</span>
          </div>
          <div className="text-[10px] text-slate-600">
            {LABELS.inChrome} · {LABELS.usingChrome}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-1 text-right shrink-0"}>
      <div title={LABELS.tipInChrome}>
        <span className="tabular-nums text-indigo-400 font-semibold text-sm">{formatDuration(openSeconds || 0)}</span>{" "}
        <span className="text-slate-500 text-xs">{LABELS.inChrome}</span>
      </div>
      <div className="text-xs text-slate-500" title={LABELS.tipUsingChrome}>
        {LABELS.usingChrome}:{" "}
        <span className="tabular-nums text-slate-400">{formatDuration(activeSeconds || 0)}</span>
      </div>
    </div>
  );
}
