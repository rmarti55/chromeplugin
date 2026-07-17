# Daily Mirror — Chrome Activity Analyzer

A **solo-only, browser-native "daily narrative" tool**. Not a team time-tracker, not
surveillance — a private mirror that measures how you actually spent your day online and
writes you an honest 3–4 sentence summary measured against your own goals.

## Principles

- **Local-first.** All activity lives in the browser (IndexedDB). There is no server.
- **Bring-your-own-key.** The daily AI summary calls OpenRouter directly with *your* API key,
  stored only on your device. Your activity is never sent anywhere except the AI provider you
  chose, and only when you ask for a summary.
- **Honest time.** Two clocks from the same event log: **In Chrome** (browser in front) and **Using Chrome** (in front + recent input). On Mac, **On your Mac** / **Using your Mac** for all apps. Site breakdowns use using Chrome. See [`docs/time-model.md`](docs/time-model.md).
- **Desktop companion (optional).** The macOS menu bar app fills the “other apps” gap and merges into the dashboard via native messaging. Optional iCloud sync enables an iPhone viewer.

## Architecture

Everything is the Chrome extension in `extension/`:

| File | Role |
|---|---|
| `background.js` | Service worker. Logs durable, timestamped events (tab/window/idle changes) to IndexedDB. Dwell time is derived at read time, so killing the worker loses nothing. Runs alarms for the passive nudge and hourly auto-summary (activity-gated). |
| `db.js` | IndexedDB wrapper + the pure session-derivation logic (events → per-URL sessions). Shared by the service worker and the dashboard. |
| `categorize.js` | Cheap local domain→category buckets (no AI/network). |
| `models.js` | Fixed OpenRouter model slug (`google/gemini-2.5-flash-lite`) and cost helper. |
| `ai.js` | The daily narrative: BYO-key OpenRouter call, goal-aware prompt, JSON parse + save. |
| `popup.html` / `popup.js` | Settings (API key, model, weekly goals) + "Summarize today" / "Open dashboard". |
| `dashboard/` | Vite + React + Recharts dashboard, opened as a full-page tab. Reads IndexedDB directly and renders the narrative, category charts, per-site time, themes, and timeline. |
| `macos/` | Optional menu bar companion — tracks desktop app focus time, native messaging bridge to Chrome, optional CloudKit sync. See [`macos/README.md`](macos/README.md). |
| `ios/` | Optional CloudKit viewer scaffold (read synced day aggregates on iPhone). See [`ios/README.md`](ios/README.md). |
| `desktop-bridge.js` / `desktop-merge.js` | Chrome ↔ Mac integration: native messaging, dedup rules, merged timeline. |

There was a **previous** server-based version (Next.js + Vercel KV + OpenRouter + Google Data
Portability import). It is parked, lives in a separate local `web/` project, and is intentionally
**not included in this repository** — v1 is the extension only.

## Setup (development)

```bash
# 1. Build the dashboard (outputs extension/dashboard/dist/)
cd extension/dashboard
npm install
npm run build

# 2. Load the extension
#    chrome://extensions → enable Developer mode → Load unpacked → select the extension/ folder
```

Then click the toolbar icon, paste an [OpenRouter API key](https://openrouter.ai/keys), write
your weekly goals, browse for a bit, and hit **Summarize today**.

### macOS companion (optional)

```bash
cd macos
swift build -c release
.build/release/DailyMirrorCompanion &   # menu bar tracker

# After loading the extension, install native messaging (replace EXT_ID):
chmod +x Scripts/install-native-host.sh
./Scripts/install-native-host.sh YOUR_CHROME_EXTENSION_ID
```

Restart Chrome. The dashboard **Overview** tab shows desktop apps alongside Chrome site detail.


## How it works

1. As you browse, the service worker records events (`activate`, `urlchange`, `focus`, `blur`,
   `idle`, `active`) to IndexedDB with timestamps. **In Chrome** accrues while Chrome is the
   frontmost app; **Using Chrome** also pauses after ~5 min without input (Chrome **idle**) or when you switch apps.
2. The dashboard reduces those events into per-URL sessions with measured seconds, then buckets
   them locally into categories — no AI needed for the basic view.
3. On demand (or automatically about once an hour when you've been active), the day's
   sessions are bundled and sent to your chosen model via OpenRouter with your goals woven in.
   Auto-summary skips API calls when nothing new happened since the last run; manual
   **Summarize** always works. You get a narrative, one honest observation, and a goal-vs-actual line.

Days are anchored to your local calendar (midnight to midnight). Week/month views can build on
this day model later.

## Summary model (OpenRouter)

All summaries use **`google/gemini-2.5-flash-lite`** via your OpenRouter key (~$0.10 / $0.40 per 1M tokens, roughly **~$0.001 per summary**). Hourly auto-summary is typically **under ~$0.05/day**.

Avoid OpenRouter `:free` promo models — they are rate-limited and can disappear.

## Chrome Web Store permission justifications

- **history / tabs / idle** — measure real, private, on-device time-on-site; idle detection
  keeps the numbers honest.
- **host_permissions: openrouter.ai** — the only outbound call: sends the day's activity to the
  AI provider you configured, using your own key, to generate the summary.
- **storage** — settings and (via IndexedDB) all activity are stored locally; clearable anytime.
- **nativeMessaging** — optional local bridge to the macOS companion for desktop app time.

No analytics. No server. No screenshots. No team/billing features.
