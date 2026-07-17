import { formatDuration } from "../../../db.js";
import { LABELS, appTimeLabel } from "../../../labels.js";

export function DesktopApps({ desktop, chromeOpenSeconds, chromeActiveSeconds, live }) {
  if (!desktop?.available) {
    return (
      <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/40 border-dashed">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Your Mac</h2>
        <p className="text-xs text-slate-500">
          Install the macOS companion and native messaging host to see your whole day — Cursor, Slack,
          and other apps alongside Chrome. See <code className="text-slate-400">macos/README.md</code>.
        </p>
      </div>
    );
  }

  const { otherApps, chromeApp, syncedDevices } = desktop;
  const macOffline = live?.status === "offline";

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-5">
      {macOffline && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p className="font-medium mb-1">{LABELS.macOfflineBanner}</p>
          <code className="text-xs text-red-300/90 break-all">{LABELS.macOfflineLaunchCmd}</code>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1" title={LABELS.tipOtherApps}>
          {LABELS.otherAppsToday}
        </h2>
        <p className="text-xs text-slate-500">
          Non-browser apps that were in front. Mac totals are in the header above.
        </p>
      </div>

      {otherApps.length > 0 ? (
        <ul className="divide-y divide-slate-700/50">
          {otherApps.slice(0, 12).map((app) => (
            <li key={app.bundleId} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-200">{app.name}</span>
              <span className="text-slate-400 tabular-nums text-xs">
                {appTimeLabel(app.presenceSeconds, app.activeSeconds)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No non-browser app time recorded yet today.</p>
      )}

      <div className="pt-4 border-t border-slate-700/50" title={LABELS.tipBrowsingChapter}>
        <h3 className="text-sm font-medium text-slate-300 mb-1">{LABELS.browsingChapter} in Chrome</h3>
        <p className="text-xs text-slate-500">
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
        <p className="text-xs text-slate-500">Also synced from {syncedDevices.length} other device(s) via iCloud.</p>
      )}
    </div>
  );
}
