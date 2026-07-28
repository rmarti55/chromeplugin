import { formatDuration } from "../../../db.js";
import { LABELS, scopedClockCaption } from "../../../labels.js";
import { Metric } from "./ui/Metric.jsx";

/** Mac-first day clocks when companion is connected; Chrome-only otherwise. */
export function DayClocks({ openSeconds, activeSeconds, desktop, layout = "stack" }) {
  const showMac = desktop?.available;

  if (showMac) {
    return (
      <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-2 text-right shrink-0"}>
        <div className="space-y-1" title={`${LABELS.tipPassiveMac} ${LABELS.tipActiveMac}`}>
          <div className="tabular-nums text-sm">
            <Metric>{formatDuration(desktop.devicePresenceSeconds || 0)}</Metric>
            <span className="text-stone-500 mx-1.5">·</span>
            <span className="text-stone-700 font-medium">{formatDuration(desktop.deviceActiveSeconds || 0)}</span>
          </div>
          <div className="text-sm font-medium text-stone-700">{LABELS.macChapter}</div>
          <div className="text-sm text-stone-600">{scopedClockCaption("mac")}</div>
        </div>
        <div className="pt-1.5 border-t border-stone-200" title={LABELS.tipBrowsingChapter}>
          <div className="text-sm font-medium text-stone-700 mb-0.5">{LABELS.chromeChapter}</div>
          <div className="tabular-nums text-sm">
            <span className="text-stone-700 font-medium">{formatDuration(openSeconds || 0)}</span>
            <span className="text-stone-500 mx-1">·</span>
            <span className="text-stone-700 font-medium">{formatDuration(activeSeconds || 0)}</span>
          </div>
          <div className="text-sm text-stone-600">{scopedClockCaption("chrome")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-1 text-right shrink-0"}>
      <div className="tabular-nums text-sm" title={`${LABELS.tipPassiveChrome} ${LABELS.tipActiveChrome}`}>
        <Metric>{formatDuration(openSeconds || 0)}</Metric>
        <span className="text-stone-500 mx-1.5">·</span>
        <span className="text-stone-700 font-medium">{formatDuration(activeSeconds || 0)}</span>
      </div>
      <div className="text-sm font-medium text-stone-700">{LABELS.chromeChapter}</div>
      <div className="text-sm text-stone-600">{scopedClockCaption("chrome")}</div>
    </div>
  );
}
