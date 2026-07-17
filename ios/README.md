# Daily Mirror — iOS Viewer

Read-only SwiftUI app that displays day aggregates synced from your Mac(s) via **CloudKit**
(same container as the macOS companion: `iCloud.com.dailymirror.companion`).

This is a **viewer** — it does not import iOS Screen Time minutes (Apple blocks that for third-party analytics).

## Setup in Xcode

1. File → New → Project → iOS App (SwiftUI)
2. Add the Swift files from `DailyMirrorViewer/`
3. Enable **iCloud** capability → CloudKit → container `iCloud.com.dailymirror.companion`
4. Sign with your Apple ID / team
5. Run on device or simulator (iCloud required for sync)

## What it shows

- Today’s device presence / active totals per synced Mac
- Top desktop apps (non-browser)
- Chrome open/active from synced payload (site detail still best on Mac dashboard)

## Privacy

Fetches only records you uploaded from your own Mac companion. No Daily Mirror server.
