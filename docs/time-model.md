# Time model

Daily Mirror tracks **two clocks** from durable event logs. User-facing labels are consistent across the Chrome extension, macOS companion, dashboard, and menu bar.

## User-facing vocabulary

| Clock | Chrome / websites | Whole Mac | Per app |
|---|---|---|---|
| **In front** | **In Chrome** | **On your Mac** | App was on screen |
| **In use** | **Using Chrome** | **Using your Mac** | In front + recent input |

Live status uses Chrome official idle states where applicable: **idle**, **locked** (via [`chrome.idle`](https://developer.chrome.com/docs/extensions/reference/api/idle)).

## Internal vs user vs official

| Internal (code) | User-facing | Official basis |
|---|---|---|
| `openSeconds` / `presenceSeconds` | In front / In Chrome / On your Mac | macOS **frontmost application** (`NSWorkspace.frontmostApplication`); Chrome focused window |
| `activeSeconds` | In use / Using Chrome / Using your Mac | Chrome idle API state **active** (recent input) |
| `idle` event | In Chrome · idle (live status only) | Chrome idle API **idle** |
| `locked` event | Screen locked | Chrome idle API **locked** |

IndexedDB, Swift, and bridge JSON keep internal field names (`presenceSeconds`, etc.) — only UI copy uses the table above.

Canonical strings live in [`extension/labels.js`](../extension/labels.js).

## Chrome extension

- **Live status / header** shows **In Chrome** and **Using Chrome** (and Mac totals when the companion is connected).
- **Site list, categories, timeline, AI narrative** use **Using Chrome** — “where was my attention?”
- **Site list** also shows **In Chrome** per page when it exceeds using Chrome (passive reading on that page).
- When the gap is large, call it out: “Chrome was in front 3h; ~45m was using Chrome.”

## macOS companion

The menu bar app (`macos/`) records desktop app focus with the same two clocks:

| Event type | Source | In use | In front |
|---|---|---|---|
| `app_activate` | frontmost app change | start for app | start for app |
| `app_blur` | app loses focus | stop | stop |
| `idle` | no input for 5 min | **stop** | continues |
| `active` | input resumes | start | continues |
| `locked` | screen lock / sleep | stop | stop |

Storage: append-only JSONL at `~/Library/Application Support/DailyMirror/events.jsonl`.

## Unified day overview (Chrome + Mac)

When the native messaging bridge is installed:

1. **On your Mac / Using your Mac** — sum of all apps in front (one app at a time; no overlap).
2. **Chrome sites** — still from the extension event log only.
3. **Other apps** — from the macOS companion, excluding browser bundle IDs.

### Dedup rules (important)

- Do **not** add Chrome site minutes on top of “Chrome as an app” in the same total.
- Overview header: **On your Mac** and **In Chrome** as separate lines (not mixed into one number).
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
