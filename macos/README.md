# Daily Mirror — macOS Companion

Menu bar app that tracks **which desktop apps are in front** and for how long, using the same **Presence / Active use** clocks as the Chrome extension.

## Requirements

- macOS 13+
- Xcode Command Line Tools (`xcode-select --install`)
- Google Chrome with the Daily Mirror extension loaded

## Install (recommended)

From the repo root, after loading the extension in Chrome:

```bash
chmod +x macos/Scripts/install-companion.sh
./macos/Scripts/install-companion.sh YOUR_CHROME_EXTENSION_ID
```

This will:

1. Build and sign the app
2. Install **`~/Applications/Daily Mirror.app`**
3. Register the Chrome native messaging host (points at the installed app, not the repo)
4. Launch the menu bar companion

Find `YOUR_CHROME_EXTENSION_ID` at `chrome://extensions` (Developer mode). Restart Chrome after installing.

## Daily use

- Look for the **clock icon** in the menu bar (top-right).
- Open the menu to see capture status, today’s clocks, Chrome bridge status, and top apps.
- Enable **Open at Login** so tracking resumes after reboot without manual launch.
- If the dashboard shows a **red** dot (“Desktop app isn't running”), the menu bar app is quit — reopen it from the menu bar or run `open ~/Applications/Daily\ Mirror.app`.
- If the dashboard shows **“Mac companion isn't working”**, re-run `./macos/Scripts/install-companion.sh YOUR_EXTENSION_ID`.

## Native messaging (Chrome bridge)

The extension talks to the companion via `chrome.runtime.connectNative('com.dailymirror.companion')`.

Host manifest location:

`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.dailymirror.companion.json`

The host path should point at:

`~/Applications/Daily Mirror.app/Contents/Helpers/native-host`

Re-run `./macos/Scripts/install-companion.sh YOUR_EXTENSION_ID` after moving the repo or reloading the unpacked extension (extension ID may change).

## Build only (developers)

```bash
cd macos
./Scripts/bundle-app.sh
open DailyMirrorCompanion.app
```

The build output in the repo is a dev artifact. Use `install-companion.sh` for the stable Applications install.

## Permissions

MVP uses **no** Accessibility, Screen Recording, or Input Monitoring prompts:

- `NSWorkspace` app activation events → Presence
- `CGEventSource` idle detection → Active use pauses after 5 min (matches extension)
- Screen lock / sleep → pause both clocks

## Data storage

Events append to:

`~/Library/Application Support/DailyMirror/events.jsonl`

Live status (red/green dot in the Chrome dashboard) uses a heartbeat at `live.json`, written every ~5s **while the menu bar app is running**. **Today** totals in the header come from `events.jsonl` and can still display when live capture is off.

Use **Open data folder** in the menu to reveal this directory.

## CloudKit (optional, future)

Day aggregates can sync to a private iCloud container for multi-device viewing. Requires CloudKit capability when packaging as a signed app. Local tracking works without iCloud.

## Distribution

Personal / Developer ID build recommended (not Mac App Store) for companion tooling. Local installs use your Apple Development certificate; notarization is needed for distribution to other Macs.
