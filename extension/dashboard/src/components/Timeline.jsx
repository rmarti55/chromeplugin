import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";

export function Timeline({ timeline, merged }) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        title={merged ? LABELS.dayByHour : "Using Chrome by hour"}
        subtitle={
          merged
            ? "Hourly view across Chrome sites and other Mac apps — one foreground app at a time."
            : "Hours with some browsing — not continuous time since the first hour shown."
        }
      />
      <div className="relative mt-4">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200" />
        <div className="space-y-4">
          {timeline.map((entry, i) => (
            <div key={i} className="relative pl-10">
              <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-accent border-2 border-white shadow-sm" />
              <div>
                <span className="text-sm font-medium text-stone-800">{entry.hour}</span>
                {merged && entry.desktopTotal > 0 && (
                  <span className="text-xs text-stone-500 ml-2">
                    {LABELS.otherApps}: {formatDuration(entry.desktopTotal)}
                  </span>
                )}
                {entry.openSeconds > 0 && (
                  <span className="text-xs text-stone-500 ml-2">
                    {LABELS.inChrome}: {formatDuration(entry.openSeconds)}
                  </span>
                )}
                {!merged && entry.desktopTotal > 0 && (
                  <span className="text-xs text-stone-500 ml-2">
                    Apps: {formatDuration(entry.desktopTotal)}
                  </span>
                )}
                <p className="text-sm text-stone-700 mt-0.5">{entry.activity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
