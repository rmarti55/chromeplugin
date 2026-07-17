import { useEffect, useState } from "react";
import { formatDuration } from "../../../db.js";
import { getLiveStatus } from "../../../live.js";

export function LiveStatus({ openSeconds, activeSeconds, desktop }) {
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
  const idle = act.status === "idle";
  const dot = paused ? "bg-amber-500" : idle ? "bg-sky-500" : "bg-green-500";

  return (
    <div className="flex items-center justify-between gap-4 mb-8 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          {!paused && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${idle ? "bg-sky-500" : "bg-green-500"}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dot}`} />
        </span>
        <span className="text-sm text-slate-300 truncate">
          {paused ? (
            act.message || "Chrome in background"
          ) : idle ? (
            act.message || "Chrome open · no input"
          ) : act.domain ? (
            <>
              Active use · <span className="text-slate-100 font-medium">{act.domain}</span>
            </>
          ) : (
            act.message || "Chrome open"
          )}
        </span>
      </div>
      <div className="text-sm text-slate-400 shrink-0 text-right">
        {desktop?.available ? (
          <>
            <div>
              <span className="tabular-nums text-indigo-400 font-semibold">
                {formatDuration(desktop.devicePresenceSeconds || 0)}
              </span>{" "}
              device presence
            </div>
            <div className="text-xs text-slate-500">
              Chrome open:{" "}
              <span className="tabular-nums text-slate-400">{formatDuration(openSeconds || 0)}</span>
              {" · "}
              active:{" "}
              <span className="tabular-nums text-slate-400">{formatDuration(activeSeconds || 0)}</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="tabular-nums text-indigo-400 font-semibold">
                {formatDuration(openSeconds || 0)}
              </span>{" "}
              Chrome open
            </div>
            <div className="text-xs text-slate-500">
              Active use:{" "}
              <span className="tabular-nums text-slate-400">{formatDuration(activeSeconds || 0)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
