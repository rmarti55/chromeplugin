import { useEffect, useState } from "react";
import {
  getLiveStatus,
  liveDotClass,
  livePingClass,
  chromeLiveStatusText,
  macLiveStatusText,
  liveRowTextColor,
} from "../../../live.js";
import { LABELS } from "../../../labels.js";
import { DayClocks } from "./DayClocks.jsx";

function LiveRow({ status, children, textClassName = "text-slate-300" }) {
  const offline = status === "offline";
  const paused = status === "paused";
  const showPing = !offline && !paused;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {showPing && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${livePingClass(status)}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveDotClass(status)}`} />
      </span>
      <span className={`text-sm truncate ${textClassName}`}>{children}</span>
    </div>
  );
}

function ChromeLiveContent({ chrome }) {
  if (!chrome) return null;
  if (chrome.status === "paused" || chrome.status === "idle" || chrome.status === "offline") {
    return chromeLiveStatusText(chrome);
  }
  if (chrome.domain) {
    return (
      <>
        {LABELS.usingChromeOn}{" "}
        <span className="text-slate-100 font-medium">{chrome.domain}</span>
      </>
    );
  }
  return chrome.message || LABELS.inChrome;
}

function MacLiveContent({ mac }) {
  if (!mac) return null;
  if (mac.status === "offline" || mac.status === "paused" || mac.status === "idle") {
    return macLiveStatusText(mac);
  }
  if (mac.appName) {
    return (
      <>
        {LABELS.usingMacOn}{" "}
        <span className="text-slate-100 font-medium">{mac.appName}</span>
      </>
    );
  }
  return macLiveStatusText(mac);
}

export function LiveStatus({ openSeconds, activeSeconds, desktop, onLiveChange }) {
  const [live, setLive] = useState({ chrome: { status: "capturing" }, mac: null });
  const macDayAvailable = !!desktop?.available;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await getLiveStatus(Date.now(), { macDayAvailable });
      if (alive) {
        setLive(next);
        onLiveChange?.(next);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [macDayAvailable, onLiveChange]);

  const { chrome, mac } = live;

  return (
    <div className="flex items-center justify-between gap-4 mb-8 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex flex-col gap-1.5 min-w-0">
        <LiveRow status={chrome?.status || "capturing"}>
          <ChromeLiveContent chrome={chrome} />
        </LiveRow>
        {mac && (
          <LiveRow status={mac.status} textClassName={liveRowTextColor(mac.status)}>
            <MacLiveContent mac={mac} />
          </LiveRow>
        )}
      </div>
      <DayClocks openSeconds={openSeconds} activeSeconds={activeSeconds} desktop={desktop} />
    </div>
  );
}
