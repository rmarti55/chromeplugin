# Time model

Daily Mirror tracks **two clocks** from durable event logs. User-facing labels are consistent across the Chrome extension, macOS companion, dashboard, and menu bar.

## User-facing vocabulary

| Clock | Chrome / websites | Whole Mac | Per app |
|---|---|---|---|
| **Passive** | **Passive in Chrome** | **Passive on Mac** | App was on screen |
| **Active** | **Active in Chrome** | **Active on Mac** | On screen + recent input |

Under section headers (**Mac**, **Chrome**), scoped captions spell out the clock pair — e.g. **Passive on Mac · Active on Mac** vs **Passive in Chrome · Active in Chrome**.

Live status uses Chrome official idle states where applicable: **idle**, **locked** (via [`chrome.idle`](https://developer.chrome.com/docs/extensions/reference/api/idle)). When the macOS companion is installed and its menu bar tracker is running, live status is **Mac-first**: the green/amber/sky dot reflects whole-Mac capture (frontmost app, idle, lock) via a heartbeat at `~/Library/Application Support/DailyMirror/live.json`, polled through native messaging `GET_LIVE`. **Mac** day totals in the header are separate from live status — they come from the event log and can display even when live capture is off.

When Mac day data exists but live capture is down, the dashboard shows a **red dot** and `Desktop app isn't running`. When the native host itself fails, the message is `Mac companion isn't working`.

## Internal vs user vs official

| Internal (code) | User-facing | Official basis |
|---|---|---|
| `openSeconds` / `presenceSeconds` | Passive / Passive in Chrome / Passive on Mac | macOS **frontmost application** (`NSWorkspace.frontmostApplication`); Chrome focused window |
| `activeSeconds` | Active / Active in Chrome / Active on Mac | Chrome idle API state **active** (recent input) |
| `idle` event | Chrome · idle (Chrome-only live) / Mac · idle (Mac-first live) | Chrome idle API **idle**; macOS no input for 5 min |
| `locked` event | Screen locked | Chrome idle API **locked** |

IndexedDB, Swift, and bridge JSON keep internal field names (`presenceSeconds`, etc.) — only UI copy uses the table above.

Canonical strings live in [`extension/labels.js`](../extension/labels.js).

## Chrome extension

- **Live status / header** leads with **Passive on Mac / Active on Mac** when the companion heartbeat is fresh; **Active · {domain}** when Chrome is frontmost; **Mac companion not capturing** (amber) when the native host is installed but the menu bar tracker is not running. Without the companion, the header shows Chrome-only live status and clocks.
- **Site list, categories, timeline** use **Active in Chrome** for website detail — “where was my attention in the browser?”
- **Site list** also shows **Passive in Chrome** per page when it exceeds active time (passive reading on that page).
- **AI narrative** tells what the person did (named apps, sites, themes, timing). It must not lead with or lecture about dual-clock gaps (passive vs active); those totals stay in the UI clocks.

## macOS companion

The menu bar app (`macos/`) records desktop app focus with the same two clocks:

| Event type | Source | Active | Passive |
|---|---|---|---|
| `app_activate` | frontmost app change | start for app | start for app |
| `app_blur` | app loses focus | stop | stop |
| `idle` | no input for 5 min | **stop** | continues |
| `active` | input resumes | start | continues |
| `locked` | screen lock / sleep | stop | stop |

Storage: append-only JSONL at `~/Library/Application Support/DailyMirror/events.jsonl`. Live heartbeat at `~/Library/Application Support/DailyMirror/live.json` (refreshed every ~5s while the menu bar app is running).

## Unified day overview (Chrome + Mac)

When the native messaging bridge is installed, Daily Mirror tells **one day story** — not two parallel products.

### Hierarchy

1. **Hero clocks — Passive on Mac / Active on Mac**  
   Authoritative day totals from the macOS companion. One app on screen at a time; this is what the header and popup lead with. The AI summary leads with named activity, not these clock pairs. Shown for **every** day on Overview (not only today).

2. **Apps list (including Chrome)**  
   All Mac apps that were frontmost — Cursor, Slack, **Chrome**, etc. — in one ranked list using the same Mac presence/active clocks. Chrome is a peer row, not a separate Overview chapter.

3. **Chrome site detail — Passive in Chrome / Active in Chrome**  
   Website breakdown from the Chrome extension event log. Lives on the **Sites** tab (and nested under Mac totals in header clocks) — **not** added to Mac totals, and **not** a second Overview list.

### Where each clock appears

| Surface | Mac hero | Apps list (incl. Chrome) | Chrome site detail |
|---|---|---|---|
| Overview header | Yes (every day) | Ranked list in Overview | Nested under Mac in header clocks |
| Sites tab | — | — | Per-site active in Chrome |
| Categories / Timeline | Merged day view when companion connected | Included in merge | Included in merge |
| AI summary | Context only (not narrated as clock pairs) | Named apps first | Site detail + categories/themes |

### Dedup rules (important)

- Do **not** add Chrome site minutes on top of “Chrome as an app” in the same total.
- Overview header: **Passive on Mac** is primary; **Passive in Chrome** is browsing detail beneath it.
- Overview app list ranks Chrome by Mac frontmost time (same as other apps); site minutes stay on Sites.
- Site breakdown, Chrome categories, and Chrome timeline minutes stay **extension-owned**.
- When Chrome is frontmost, macOS records `com.google.Chrome` (or your browser bundle ID); site detail still comes only from Chrome tab events.

## Chrome History (reference)

| **Chrome History** | Every page load Chrome recorded | Reference only — visits, not focus time |

Daily Mirror reads `chrome.history.getVisits` for a **side-by-side alignment** table. Time clocks still come from event logs only.

## Likely-automated activity

We flag rapid reloads, query churn, and burst navigation from event shape. These are **heuristics**, not proof that an AI agent drove the tab.

## Cross-device (CloudKit)

Optional sync uploads **day aggregates** (not raw events) to your private iCloud container for multi-Mac / iPhone **viewer**. iOS Screen Time APIs do **not** export per-app minutes into Daily Mirror — phone is a viewer/nudge surface, not a usage peer.

## Shared event schema (conceptual)

### Chrome (`extension/db.js`)

```js
{ ts, type, tabId?, url?, title?, domain? }
// types: activate | urlchange | focus | blur | idle | active | locked
```

### macOS (`macos/Sources/DailyMirrorCompanion/`)

```js
{ ts, type, bundleId?, appName? }
// types: app_activate | app_blur | idle | active | locked
```

### Derived session (both platforms)

```js
{ target, presenceSeconds, activeSeconds }
// Chrome target = url/domain; macOS target = bundleId + display name
```

Bridge payload (`GET_DAY` native message):

```js
{
  date: "YYYY-MM-DD",
  presenceSeconds, activeSeconds,
  apps: [{ bundleId, name, presenceSeconds, activeSeconds }],
  timeline: [{ hour, hourStartTs, activity, total, apps }],
  categories: [{ name, seconds, minutes }],
  deviceId, syncedDevices
}
```
