# Daily Mirror — Chrome Activity Analyzer

A **solo-only, browser-native "daily narrative" tool**. Not a team time-tracker, not
surveillance — a private mirror that measures how you actually spent your day online and
writes you an honest 3–4 sentence summary measured against your own goals.

## Principles

- **Local-first.** All activity lives in the browser (IndexedDB). There is no server.
- **Bring-your-own-key.** The daily AI summary calls OpenRouter directly with *your* API key,
  stored only on your device. Your activity is never sent anywhere except the AI provider you
  chose, and only when you ask for a summary.
- **Honest time.** Two clocks from the same event log: **Chrome open** (browser in front) and **Active use** (in front + recent input). Site breakdowns use active use; the day total leads with Chrome open. See [`docs/time-model.md`](docs/time-model.md).

## Architecture

Everything is the Chrome extension in `extension/`:

| File | Role |
|---|---|
| `background.js` | Service worker. Logs durable, timestamped events (tab/window/idle changes) to IndexedDB. Dwell time is derived at read time, so killing the worker loses nothing. Runs alarms for the passive nudge and hourly auto-summary (activity-gated). |
| `db.js` | IndexedDB wrapper + the pure session-derivation logic (events → per-URL sessions). Shared by the service worker and the dashboard. |
| `categorize.js` | Cheap local domain→category buckets (no AI/network). |
| `models.js` | OpenRouter model presets (Budget / Balanced / Premium) and cost helpers. |
| `ai.js` | The daily narrative: BYO-key OpenRouter call, goal-aware prompt, JSON parse + save. Default model: Gemini 2.5 Flash Lite. |
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
   `idle`, `active`) to IndexedDB with timestamps. **Chrome open** accrues while Chrome is the
   focused app; **Active use** also pauses after ~60s without input or when you switch apps.
2. The dashboard reduces those events into per-URL sessions with measured seconds, then buckets
   them locally into categories — no AI needed for the basic view.
3. On demand (or automatically about once an hour when you've been active), the day's
   sessions are bundled and sent to your chosen model via OpenRouter with your goals woven in.
   Auto-summary skips API calls when nothing new happened since the last run; manual
   **Summarize** always works. You get a narrative, one honest observation, and a goal-vs-actual line.

Days are anchored to your local calendar (midnight to midnight). Week/month views can build on
this day model later.

## Model tiers (OpenRouter)

Pick a preset in dashboard **Settings**. All use your own OpenRouter credits — avoid `:free` promo
models (rate-limited and can disappear).

| Preset | Model | Typical cost per summary | Notes |
|--------|-------|--------------------------|-------|
| **Balanced** (default) | `google/gemini-2.5-flash-lite` | ~$0.001 | Recommended for hourly auto-summary |
| **Budget** | `qwen/qwen3.5-flash-02-23` | ~$0.0005–0.002 | Cheapest list price; can be verbose on output |
| **Premium** | `anthropic/claude-sonnet-4.5` | ~$0.03 | Best narrative; use for manual re-summarize |

Rough daily cost at **hourly auto-summary** with Balanced: **under ~$0.05/day**. Premium Sonnet
at the same cadence is **~$0.50–1.00/day**.

Re-run benchmarks after major prompt changes:

```bash
OPENROUTER_API_KEY=sk-or-... node scripts/benchmark-models.mjs
```

## Chrome Web Store permission justifications

- **history / tabs / idle** — measure real, private, on-device time-on-site; idle detection
  keeps the numbers honest.
- **host_permissions: openrouter.ai** — the only outbound call: sends the day's activity to the
  AI provider you configured, using your own key, to generate the summary.
- **storage** — settings and (via IndexedDB) all activity are stored locally; clearable anytime.

No analytics. No server. No screenshots. No team/billing features.
