# Time model

Daily Mirror tracks two clocks from durable event logs. The Chrome extension and macOS companion use the same vocabulary.

| Term | Meaning | Stops when |
|---|---|---|
| **Presence** (Chrome: *Chrome open*) | The app is in front | You switch to another app, or the screen locks |
| **Active use** | App in front + you recently used mouse/keyboard | Same as above, **or** ~5 min with no input (idle) |

## Chrome extension

- **Header / today total** leads with **Chrome open** (Presence for Chrome only).
- **Site list, categories, timeline, AI narrative** use **Active use** — “where was my attention?”
- **Site list** also shows **Chrome open** per page when it exceeds active use (passive reading on that page).
- When the gap is large, call it out: “Chrome was open 3h; ~45m was active use.”

## macOS companion

The menu bar app (`macos/`) records desktop app focus with the same two clocks:

| Event type | Source | Active use | Presence |
|---|---|---|---|
| `app_activate` | foreground app change | start for app | start for app |
| `app_blur` | app loses focus | stop | stop |
| `idle` | no input for 5 min | **stop** | continues |
| `active` | input resumes | start | continues |
| `locked` | screen lock / sleep | stop | stop |

Storage: append-only JSONL at `~/Library/Application Support/DailyMirror/events.jsonl`.

## Unified day overview (Chrome + Mac)

When the native messaging bridge is installed:

1. **Device presence / active** — sum of all foreground apps (one app at a time; no overlap).
2. **Chrome sites** — still from the extension event log only.
3. **Other apps** — from the macOS companion, excluding browser bundle IDs.

### Dedup rules (important)

- Do **not** add Chrome site minutes on top of “Chrome as an app” in the same total.
- Overview header: **device presence** (or Chrome open + other-app presence as separate lines).
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
