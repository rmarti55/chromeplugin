import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";
import { Metric } from "./ui/Metric.jsx";

/** Mac-first day clocks when companion is connected; Chrome-only otherwise. */
export function DayClocks({ openSeconds, activeSeconds, desktop, layout = "stack" }) {
  const showMac = desktop?.available;

  if (showMac) {
    return (
      <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-2 text-right shrink-0"}>
        <div className="space-y-1" title={`${LABELS.tipOnMac} ${LABELS.tipUsingMac}`}>
          <div className="tabular-nums">
            <Metric className="text-sm">{formatDuration(desktop.devicePresenceSeconds || 0)}</Metric>
            <span className="text-stone-300 mx-1.5">·</span>
            <span className="text-stone-600 text-sm">{formatDuration(desktop.deviceActiveSeconds || 0)}</span>
          </div>
          <div className="text-[11px] text-stone-400 tracking-wide">{LABELS.todayOnMac}</div>
        </div>
        <div className="pt-1.5 border-t border-stone-200" title={LABELS.tipBrowsingChapter}>
          <div className="text-[11px] tracking-wide text-stone-400 mb-0.5">{LABELS.browsingChapter}</div>
          <div className="tabular-nums text-xs">
            <span className="text-stone-600">{formatDuration(openSeconds || 0)}</span>
            <span className="text-stone-300 mx-1">·</span>
            <span className="text-stone-500">{formatDuration(activeSeconds || 0)}</span>
          </div>
          <div className="text-[11px] text-stone-400">
            {LABELS.inChrome} · {LABELS.usingChrome}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-1 text-right shrink-0"}>
      <div title={LABELS.tipInChrome}>
        <Metric className="text-sm">{formatDuration(openSeconds || 0)}</Metric>{" "}
        <span className="text-stone-500 text-xs">{LABELS.inChrome}</span>
      </div>
      <div className="text-xs text-stone-500" title={LABELS.tipUsingChrome}>
        {LABELS.usingChrome}:{" "}
        <span className="tabular-nums text-stone-600">{formatDuration(activeSeconds || 0)}</span>
      </div>
    </div>
  );
}
