import { useEffect, useState } from "react";
import { getLiveStatus } from "../../../live.js";
import { LABELS } from "../../../labels.js";
import { DayClocks } from "./DayClocks.jsx";

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
            act.message || LABELS.inBackground
          ) : idle ? (
            act.message || LABELS.idle
          ) : act.domain ? (
            <>
              {LABELS.usingChromeOn}{" "}
              <span className="text-slate-100 font-medium">{act.domain}</span>
            </>
          ) : act.appName ? (
            <>
              {LABELS.usingMacOn}{" "}
              <span className="text-slate-100 font-medium">{act.appName}</span>
            </>
          ) : (
            act.message || LABELS.inChrome
          )}
        </span>
      </div>
      <DayClocks
        openSeconds={openSeconds}
        activeSeconds={activeSeconds}
        desktop={desktop}
        live={act}
      />
    </div>
  );
}
