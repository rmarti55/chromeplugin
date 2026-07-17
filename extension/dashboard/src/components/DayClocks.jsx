import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";

function LiveDot({ status }) {
  const paused = status === "paused";
  const idle = status === "idle";
  const dot = paused ? "bg-amber-500" : idle ? "bg-sky-500" : "bg-green-500";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {!paused && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${idle ? "bg-sky-500" : "bg-green-500"}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
    </span>
  );
}

function MacLiveLine({ live }) {
  if (!live?.macHostInstalled) return null;

  const paused = live.status === "paused";
  const idle = live.status === "idle";

  let text = live.message || LABELS.macNotCapturing;
  if (!paused && !idle && live.appName) {
    text = `${LABELS.usingMacOn} ${live.appName}`;
  } else if (!paused && !idle && live.domain) {
    text = `${LABELS.usingChromeOn} ${live.domain}`;
  }

  return (
    <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
      <LiveDot status={live.status} />
      <span className="truncate max-w-[220px]" title={text}>
        {text}
      </span>
    </div>
  );
}

/** Mac-first day clocks when companion is connected; Chrome-only otherwise. */
export function DayClocks({ openSeconds, activeSeconds, desktop, layout = "stack", live }) {
  const showMac = desktop?.available;

  if (showMac) {
    return (
      <div className={layout === "inline" ? "space-y-1 text-right" : "space-y-2 text-right shrink-0"}>
        <div className="space-y-1" title={`${LABELS.tipOnMac} ${LABELS.tipUsingMac}`}>
          <MacLiveLine live={live} />
          <div className="tabular-nums">
            <span className="text-indigo-400 font-semibold text-sm">
              {formatDuration(desktop.devicePresenceSeconds || 0)}
            </span>
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-slate-300 text-sm">{formatDuration(desktop.deviceActiveSeconds || 0)}</span>
          </div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">
            {LABELS.todayOnMac} · {LABELS.onMac} · {LABELS.usingMac}
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
