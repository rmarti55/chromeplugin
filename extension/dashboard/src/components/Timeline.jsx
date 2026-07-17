import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";

export function Timeline({ timeline, merged }) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">
        {merged ? LABELS.dayByHour : "Using Chrome by hour"}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        {merged
          ? "Hourly view across Chrome sites and other Mac apps — one foreground app at a time."
          : "Hours with some browsing — not continuous time since the first hour shown."}
      </p>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-600" />
        <div className="space-y-4">
          {timeline.map((entry, i) => (
            <div key={i} className="relative pl-10">
              <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-800" />
              <div>
                <span className="text-sm font-medium text-indigo-400">{entry.hour}</span>
                {merged && entry.desktopTotal > 0 && (
                  <span className="text-xs text-slate-500 ml-2">
                    {LABELS.otherApps}: {formatDuration(entry.desktopTotal)}
                  </span>
                )}
                {entry.openSeconds > 0 && (
                  <span className="text-xs text-slate-500 ml-2">
                    {LABELS.inChrome}: {formatDuration(entry.openSeconds)}
                  </span>
                )}
                {!merged && entry.desktopTotal > 0 && (
                  <span className="text-xs text-slate-500 ml-2">
                    Apps: {formatDuration(entry.desktopTotal)}
                  </span>
                )}
                <p className="text-sm text-slate-300 mt-0.5">{entry.activity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
