import { useEffect, useState } from "react";
import { getCurrentActivity, formatDuration } from "../../../db.js";

// Live "it's capturing" bar. The current-session line ticks every second; the
// day total is passed in from App (refreshed on its own poll).
export function LiveStatus({ totalSeconds }) {
  const [act, setAct] = useState({ status: "idle" });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const a = await getCurrentActivity(Date.now());
      if (alive) setAct(a);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const capturing = act.status === "capturing";
  const paused = act.status === "paused";
  const dot = capturing ? "bg-green-500" : paused ? "bg-amber-500" : "bg-slate-500";

  return (
    <div className="flex items-center justify-between gap-4 mb-8 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          {capturing && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dot}`} />
        </span>
        <span className="text-sm text-slate-300 truncate">
          {capturing ? (
            <>
              Capturing · <span className="text-slate-100 font-medium">{act.domain}</span> ·{" "}
              <span className="tabular-nums text-slate-100">{formatDuration(act.elapsedSeconds)}</span>
            </>
          ) : paused ? (
            "Paused — no active page right now"
          ) : (
            "Ready — browse to start tracking"
          )}
        </span>
      </div>
      <div className="text-sm text-slate-400 shrink-0">
        <span className="tabular-nums text-indigo-400 font-semibold">{formatDuration(totalSeconds || 0)}</span> today
      </div>
    </div>
  );
}
