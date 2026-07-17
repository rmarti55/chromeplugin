# Daily Mirror — Privacy Policy

_Last updated: July 2026_

Daily Mirror is a **private, on-device** tool. We do not operate any server, and we never receive,
store, or have access to your data.

## What is stored, and where

- **Your browsing activity** (page URLs, titles, and measured active time) is stored **only in your
  browser**, in local IndexedDB. It never leaves your device except as described below.
- **Your settings** (OpenRouter API key, chosen model, and your weekly goals) are stored **only in
  your browser**, in `chrome.storage.local`.
- **Desktop app activity** (app names, bundle identifiers, and measured focus time) is stored **only
  on your Mac** by the optional menu bar companion, in local JSONL at
  `~/Library/Application Support/DailyMirror/events.jsonl`. No window titles, screenshots, or
  keystrokes are captured in the default configuration.

## Local bridge (Chrome ↔ Mac)

When you install the native messaging host, the Chrome extension reads **day aggregates** from the
macOS companion over a local stdio channel. This traffic never leaves your machine and does not pass
through any server we operate.

## Optional iCloud sync

If you enable CloudKit in a signed build of the macOS companion, **day summary payloads** may sync
to your private iCloud account so another Mac or the iPhone viewer can display the same overview.
This uses Apple’s CloudKit — not a Daily Mirror server. Raw event logs stay on each Mac unless you
choose to extend sync later.

## The one time data leaves your device

When _you_ request a daily summary (by clicking “Summarize”, or via the optional hourly
auto-summary when you've been active), the day’s activity is sent **directly from your browser** to
[OpenRouter](https://openrouter.ai/privacy), using **your own API key**, so an AI model can write
your narrative. When the macOS companion is connected, **top desktop app names and minutes** may be
included in that prompt. This is the only outbound network request the extension makes. We are not a
party to that transfer and never see it.

## What we do NOT do

- No analytics, telemetry, or tracking of any kind.
- No servers, accounts, or cloud sync operated by us (optional iCloud is yours via Apple).
- No selling, sharing, or transmitting your data to us or any third party (other than the AI
  provider you configured, at your request).
- No screenshots, keystroke logging, or capture of page contents beyond URL and title.

## Permissions

- **history / tabs / idle** — measure how you spend time across sites, locally; idle detection
  avoids counting time when you’re away.
- **storage** — keep your activity and settings on your device.
- **nativeMessaging** — read desktop app time from the local macOS companion (optional).
- **openrouter.ai host access** — send the summary request you initiate.

## Deleting your data

Clear all stored activity at any time by removing the extension or clearing the extension’s site
data. Uninstalling deletes browser data. Remove `~/Library/Application Support/DailyMirror/` to
delete desktop companion events.
