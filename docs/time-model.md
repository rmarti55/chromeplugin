# Time model

Daily Mirror tracks **two clocks** from durable event logs. User-facing labels are consistent across the Chrome extension, macOS companion, dashboard, and menu bar.

## User-facing vocabulary

| Clock | Chrome / websites | Whole Mac | Per app |
|---|---|---|---|
| **In front** | **In Chrome** | **On your Mac** | App was on screen |
| **In use** | **Using Chrome** | **Using your Mac** | In front + recent input |

Live status uses Chrome official idle states where applicable: **idle**, **locked** (via [`chrome.idle`](https://developer.chrome.com/docs/extensions/reference/api/idle)). When the macOS companion is installed and its menu bar tracker is running, live status is **Mac-first**: the green/amber/sky dot reflects whole-Mac capture (frontmost app, idle, lock) via a heartbeat at `~/Library/Application Support/DailyMirror/live.json`, polled through native messaging `GET_LIVE`. Without the companion, live status falls back to Chrome-only focus and idle.

## Internal vs user vs official

| Internal (code) | User-facing | Official basis |
|---|---|---|
| `openSeconds` / `presenceSeconds` | In front / In Chrome / On your Mac | macOS **frontmost application** (`NSWorkspace.frontmostApplication`); Chrome focused window |
| `activeSeconds` | In use / Using Chrome / Using your Mac | Chrome idle API state **active** (recent input) |
| `idle` event | In Chrome · idle (Chrome-only live) / On your Mac · idle (Mac-first live) | Chrome idle API **idle**; macOS no input for 5 min |
| `locked` event | Screen locked | Chrome idle API **locked** |

IndexedDB, Swift, and bridge JSON keep internal field names (`presenceSeconds`, etc.) — only UI copy uses the table above.

Canonical strings live in [`extension/labels.js`](../extension/labels.js).

## Chrome extension

- **Live status / header** leads with **On your Mac / Using your Mac** when the companion heartbeat is fresh; **Using Chrome · {domain}** when Chrome is frontmost; **Mac companion not capturing** (amber) when the native host is installed but the menu bar tracker is not running. Without the companion, the header shows Chrome-only live status and clocks.
- **Site list, categories, timeline** use **Using Chrome** for website detail — “where was my attention in the browser?”
- **Site list** also shows **In Chrome** per page when it exceeds using Chrome (passive reading on that page).
- **AI narrative** tells what the person did (named apps, sites, themes, timing). It must not lead with or lecture about dual-clock gaps (“in front” vs “in use”); those totals stay in the UI clocks.

## macOS companion

The menu bar app (`macos/`) records desktop app focus with the same two clocks:

| Event type | Source | In use | In front |
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

1. **Hero clocks — On your Mac / Using your Mac**  
   Authoritative day totals from the macOS companion. One app in front at a time; this is what the header and popup lead with. The AI summary leads with named activity, not these clock pairs.

2. **Browsing chapter — In Chrome / Using Chrome**  
   Website detail from the Chrome extension event log. Shown nested under Mac totals — **not** added to them.

3. **Other apps**  
   Non-browser apps from the macOS companion (Cursor, Slack, etc.), listed separately.

### Where each clock appears

| Surface | Mac hero | Browsing chapter | Other apps |
|---|---|---|---|
| Overview header / popup | Yes | Nested below | List in Overview |
| Sites tab | — | Per-site using Chrome | — |
| Categories / Timeline | Merged day view when companion connected | Included in merge | Included in merge |
| AI summary | Context only (not narrated as clock pairs) | Site detail + categories/themes | Named first in narrative |

### Dedup rules (important)

- Do **not** add Chrome site minutes on top of “Chrome as an app” in the same total.
- Overview header: **On your Mac** is primary; **In Chrome** is the browsing chapter beneath it.
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
