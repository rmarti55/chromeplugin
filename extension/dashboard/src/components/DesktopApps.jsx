import { formatDuration } from "../../../db.js";
import { LABELS, appTimeLabel } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";

export function DesktopApps({ desktop, chromeOpenSeconds, chromeActiveSeconds, live }) {
  if (!desktop?.available) {
    return (
      <Card dashed className="p-5">
        <SectionHeader title="Your Mac" />
        <p className="text-sm text-stone-700 mt-2">
          Install the macOS companion and native messaging host to see your whole day — Cursor, Slack,
          and other apps alongside Chrome. See <code className="text-stone-800">macos/README.md</code>.
        </p>
      </Card>
    );
  }

  const { otherApps, chromeApp, syncedDevices } = desktop;
  const macOffline = live?.mac?.status === "offline";

  return (
    <Card className="space-y-5">
      {macOffline && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium mb-1">{LABELS.macOfflineBanner}</p>
          <code className="text-sm text-red-700 break-all">{LABELS.macOfflineLaunchCmd}</code>
        </div>
      )}

      <SectionHeader
        title={LABELS.otherAppsToday}
        subtitle="Non-browser apps that were in front. Mac totals are in the header above."
      />

      {otherApps.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {otherApps.slice(0, 12).map((app) => (
            <li key={app.bundleId} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-stone-800">{app.name}</span>
              <Metric muted className="text-sm">{appTimeLabel(app.presenceSeconds, app.activeSeconds)}</Metric>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-700">No non-browser app time recorded yet today.</p>
      )}

      <div className="pt-4 border-t border-stone-200" title={LABELS.tipBrowsingChapter}>
        <h3 className="text-sm font-medium text-stone-800 mb-1">{LABELS.chromeChapter}</h3>
        <p className="text-sm text-stone-700">
          {LABELS.inChrome}: {formatDuration(chromeOpenSeconds)} · {LABELS.usingChrome}:{" "}
          {formatDuration(chromeActiveSeconds)}
          {chromeApp ? (
            <>
              {" "}
              · Chrome as an app was {formatDuration(chromeApp.presenceSeconds)} {LABELS.inFront.toLowerCase()}
            </>
          ) : null}
          . Site breakdown is on the Sites tab.
        </p>
      </div>

      {syncedDevices?.length > 0 && (
        <p className="text-sm text-stone-600">Also synced from {syncedDevices.length} other device(s) via iCloud.</p>
      )}
    </Card>
  );
}
