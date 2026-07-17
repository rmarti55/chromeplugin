import { formatDuration } from "../../../db.js";
import { LABELS, appTimeLabel } from "../../../labels.js";

export function DesktopApps({ desktop, chromeOpenSeconds, chromeActiveSeconds }) {
  if (!desktop?.available) {
    return (
      <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/40 border-dashed">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Desktop apps</h2>
        <p className="text-xs text-slate-500">
          Install the macOS companion and native messaging host to see Cursor, Slack, and other apps
          here. See <code className="text-slate-400">macos/README.md</code>.
        </p>
      </div>
    );
  }

  const { devicePresenceSeconds, deviceActiveSeconds, otherApps, chromeApp, otherPresenceSeconds, syncedDevices } =
    desktop;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Your Mac today</h2>
        <p className="text-xs text-slate-500">
          Time each app was in front. Website times are separate.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-slate-900/50 rounded-lg p-3" title={LABELS.tipOnMac}>
          <div className="text-xs text-slate-500 mb-1">{LABELS.onMac}</div>
          <div className="text-indigo-300 font-semibold tabular-nums">{formatDuration(devicePresenceSeconds)}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3" title={LABELS.tipUsingMac}>
          <div className="text-xs text-slate-500 mb-1">{LABELS.usingMac}</div>
          <div className="text-slate-200 font-semibold tabular-nums">{formatDuration(deviceActiveSeconds)}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3" title={LABELS.tipInChrome}>
          <div className="text-xs text-slate-500 mb-1">{LABELS.inChrome}</div>
          <div className="text-slate-300 tabular-nums">{formatDuration(chromeOpenSeconds)}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">{LABELS.otherApps}</div>
          <div className="text-slate-300 tabular-nums">{formatDuration(otherPresenceSeconds)}</div>
        </div>
      </div>

      {chromeApp && (
        <p className="text-xs text-slate-500">
          Chrome (whole app): {formatDuration(chromeApp.presenceSeconds)} {LABELS.inFront.toLowerCase()}. Websites
          below use {formatDuration(chromeActiveSeconds)} {LABELS.inChrome.toLowerCase()}.
        </p>
      )}

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

      {syncedDevices?.length > 0 && (
        <p className="text-xs text-slate-500">Also synced from {syncedDevices.length} other device(s) via iCloud.</p>
      )}
    </div>
  );
}
