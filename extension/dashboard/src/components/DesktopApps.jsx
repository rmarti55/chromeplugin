import { LABELS, appTimeLabel } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";
import { ActivityMetricsColumn } from "./ui/ActivityMetricsColumn.jsx";

/** Ranked Mac apps for Overview — Chrome included as a peer, not a separate chapter. */
export function DesktopApps({ desktop, live }) {
  if (!desktop?.available) {
    return (
      <Card dashed className="p-5">
        <SectionHeader title="Your Mac" />
        <p className="text-sm text-stone-700 mt-2">
          Install the macOS companion and native messaging host to see your whole day — Cursor, Slack,
          Chrome, and other apps. See <code className="text-stone-800">macos/README.md</code>.
        </p>
      </Card>
    );
  }

  const { otherApps, chromeApp, syncedDevices } = desktop;
  const apps = [...(otherApps || []), ...(chromeApp ? [chromeApp] : [])].sort(
    (a, b) => (b.presenceSeconds || 0) - (a.presenceSeconds || 0)
  );
  const macOffline = live?.mac?.status === "offline";
  const displayedApps = apps.slice(0, 12);
  const maxPresence = Math.max(0, ...displayedApps.map((a) => a.presenceSeconds || 0));

  return (
    <Card className="space-y-5">
      {macOffline && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium mb-1">{LABELS.macOfflineBanner}</p>
          <code className="text-sm text-red-700 break-all">{LABELS.macOfflineLaunchCmd}</code>
        </div>
      )}

      <SectionHeader title={LABELS.appsToday} subtitle={LABELS.appsTodaySubtitle} />

      {apps.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {displayedApps.map((app) => (
            <li key={app.bundleId} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span className="font-medium text-stone-800 min-w-0 flex-1">{app.name}</span>
              <ActivityMetricsColumn
                metric={
                  <Metric muted className="text-sm">
                    {appTimeLabel(app.presenceSeconds, app.activeSeconds)}
                  </Metric>
                }
                barValue={app.presenceSeconds || 0}
                barMax={maxPresence}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-700">{LABELS.appsTodayEmpty}</p>
      )}

      {syncedDevices?.length > 0 && (
        <p className="text-sm text-stone-600">Also synced from {syncedDevices.length} other device(s) via iCloud.</p>
      )}
    </Card>
  );
}
