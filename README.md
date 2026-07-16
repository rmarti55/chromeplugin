# Daily Mirror — Chrome Activity Analyzer

A **solo-only, browser-native "daily narrative" tool**. Not a team time-tracker, not
surveillance — a private mirror that measures how you actually spent your day online and
writes you an honest 3–4 sentence summary measured against your own goals.

## Principles

- **Local-first.** All activity lives in the browser (IndexedDB). There is no server.
- **Bring-your-own-key.** The daily AI summary calls OpenRouter directly with *your* API key,
  stored only on your device. Your activity is never sent anywhere except the AI provider you
  chose, and only when you ask for a summary.
- **Honest time.** Time-on-site is *measured* active time (idle time excluded), not estimated
  from visit counts.

## Architecture

Everything is the Chrome extension in `extension/`:

| File | Role |
|---|---|
| `background.js` | Service worker. Logs durable, timestamped events (tab/window/idle changes) to IndexedDB. Dwell time is derived at read time, so killing the worker loses nothing. Runs alarms for the passive nudge and hourly auto-summary (activity-gated). |
| `db.js` | IndexedDB wrapper + the pure session-derivation logic (events → per-URL sessions). Shared by the service worker and the dashboard. |
| `categorize.js` | Cheap local domain→category buckets (no AI/network). |
| `ai.js` | The daily narrative: BYO-key OpenRouter call, goal-aware prompt, JSON parse + save. |
| `popup.html` / `popup.js` | Settings (API key, model, weekly goals) + "Summarize today" / "Open dashboard". |
| `dashboard/` | Vite + React + Recharts dashboard, opened as a full-page tab. Reads IndexedDB directly and renders the narrative, category charts, per-site time, themes, and timeline. |

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

## How it works

1. As you browse, the service worker records events (`activate`, `urlchange`, `focus`, `blur`,
   `idle`, `active`) to IndexedDB with timestamps. Nothing is counted while you're idle or on
   non-web pages.
2. The dashboard reduces those events into per-URL sessions with measured seconds, then buckets
   them locally into categories — no AI needed for the basic view.
3. On demand (or automatically about once an hour when you've been active), the day's
   sessions are bundled and sent to Claude via OpenRouter with your goals woven in. Auto-summary
   skips API calls when nothing new happened since the last run; manual **Summarize** always
   works. You get a narrative, one honest observation, and a goal-vs-actual line.

Days are anchored to your local calendar (midnight to midnight). Week/month views can build on
this day model later.

## Chrome Web Store permission justifications

- **history / tabs / idle** — measure real, private, on-device time-on-site; idle detection
  keeps the numbers honest.
- **host_permissions: openrouter.ai** — the only outbound call: sends the day's activity to the
  AI provider you configured, using your own key, to generate the summary.
- **storage** — settings and (via IndexedDB) all activity are stored locally; clearable anytime.

No analytics. No server. No screenshots. No team/billing features.
