import { useEffect, useState } from "react";
import { formatDuration } from "../../../db.js";
import { getLiveStatus } from "../../../live.js";

// Live "it's capturing" bar. Status reflects real idle state (not which tab is
// active), so viewing the dashboard still reads "Capturing". The day total is
// passed in from App (refreshed on its own poll).
export function LiveStatus({ totalSeconds }) {
  const [act, setAct] = useState({ status: "capturing" });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const a = await getLiveStatus(Date.now());
      if (alive) setAct(a);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const paused = act.status === "paused";
  const dot = paused ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="flex items-center justify-between gap-4 mb-8 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          {!paused && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dot}`} />
        </span>
        <span className="text-sm text-slate-300 truncate">
          {paused ? (
            "Paused — you're idle"
          ) : act.domain ? (
            <>
              Capturing · <span className="text-slate-100 font-medium">{act.domain}</span>
            </>
          ) : (
            "Capturing your activity"
          )}
        </span>
      </div>
      <div className="text-sm text-slate-400 shrink-0">
        <span className="tabular-nums text-indigo-400 font-semibold">{formatDuration(totalSeconds || 0)}</span> today
      </div>
    </div>
  );
}
