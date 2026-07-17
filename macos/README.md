# Daily Mirror — macOS Companion

Menu bar app that tracks **which desktop apps are in front** and for how long, using the same **Presence / Active use** clocks as the Chrome extension.

## Requirements

- macOS 13+
- Xcode Command Line Tools (`xcode-select --install`)
- Optional: iCloud account for CloudKit sync (Phase 3)

## Build

```bash
cd macos
swift build -c release
.build/release/DailyMirrorCompanion &
```

## Native messaging (Chrome bridge)

After loading the extension in Chrome, install the native host:

```bash
chmod +x Scripts/install-native-host.sh
./Scripts/install-native-host.sh YOUR_CHROME_EXTENSION_ID
```

Restart Chrome. The extension dashboard will pull desktop app time via `chrome.runtime.connectNative('com.dailymirror.companion')`.

## Permissions

MVP uses **no** Accessibility, Screen Recording, or Input Monitoring prompts:

- `NSWorkspace` app activation events → Presence
- `CGEventSource` idle detection → Active use pauses after 5 min (matches extension)
- Screen lock / sleep → pause both clocks

## Data storage

Events append to:

`~/Library/Application Support/DailyMirror/events.jsonl`

Live status (green light in the Chrome dashboard) uses a heartbeat at `live.json`, written every ~5s **only while the menu bar app is running**. If you see Mac day totals but amber “not capturing”, launch the app:

```bash
open macos/DailyMirrorCompanion.app
```

## CloudKit (optional)

Day aggregates can sync to your private iCloud container (`iCloud.com.dailymirror.companion`) for multi-Mac / iPhone viewer. Requires CloudKit capability when packaging as a signed app. Local tracking works without iCloud.

## Distribution

Personal / Developer ID build recommended (not Mac App Store) for companion tooling.
