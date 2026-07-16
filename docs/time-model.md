# Time model

Daily Mirror tracks two clocks from the same Chrome event log.

| Term | Meaning | Stops when |
|---|---|---|
| **Chrome open** | Chrome is the app in front | You switch to another app, or the screen locks |
| **Active use** | Chrome in front + you recently used mouse/keyboard | Same as above, **or** ~60s with no input (idle) |

## How we use them (Chrome extension)

- **Header / today total** leads with **Chrome open** — “how long was the browser my foreground app?”
- **Site list, categories, timeline, AI narrative** use **Active use** — “where was my attention?”
- When the gap is large, call it out: “Chrome was open 3h; ~45m was active use.”

## What we do not measure

- Time in other apps (Cursor, Slack, Terminal)
- Background Chrome tabs while another app is in front
- Chrome History visit counts (we derive from tab/focus events, not `chrome.history`)

## Likely-automated activity

We flag rapid reloads, query churn, and burst navigation from event shape. These are **heuristics**, not proof that an AI agent drove the tab. We never label Claude, Codex, or Cursor as the initiator.

## Later: multi-device

This doc applies to the **Chrome extension** only. A future macOS + iOS platform can unify one day story across devices using the same two ideas:

- **Active use** — you were interacting
- **Presence** — the app/device was in front (or primary)

Revisit this file when adding those form factors.
