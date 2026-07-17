import { useEffect, useState } from "react";
import { getLiveStatus, liveDotClass, livePingClass, liveStatusText } from "../../../live.js";
import { LABELS } from "../../../labels.js";
import { DayClocks } from "./DayClocks.jsx";

export function LiveStatus({ openSeconds, activeSeconds, desktop, onLiveChange }) {
  const [act, setAct] = useState({ status: "capturing" });
  const macDayAvailable = !!desktop?.available;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const a = await getLiveStatus(Date.now(), { macDayAvailable });
      if (alive) {
        setAct(a);
        onLiveChange?.(a);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [macDayAvailable, onLiveChange]);

  const offline = act.status === "offline";
  const paused = act.status === "paused";
  const idle = act.status === "idle";
  const showPing = !offline && !paused;
  const dot = liveDotClass(act.status);
  const text = liveStatusText(act);
  const macFirst = macDayAvailable || act.macHostInstalled;

  return (
    <div className="flex items-center justify-between gap-4 mb-8 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative flex h-3 w-3 shrink-0">
          {showPing && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${livePingClass(act.status)}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dot}`} />
        </span>
        <span className={`text-sm truncate ${offline ? "text-red-300" : "text-slate-300"}`}>
          {!macFirst && act.domain ? (
            <>
              {LABELS.usingChromeOn}{" "}
              <span className="text-slate-100 font-medium">{act.domain}</span>
            </>
          ) : !macFirst && act.appName ? (
            <>
              {LABELS.usingMacOn}{" "}
              <span className="text-slate-100 font-medium">{act.appName}</span>
            </>
          ) : offline ? (
            text
          ) : paused || idle ? (
            text
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
            text
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
