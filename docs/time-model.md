# Time model

Daily Mirror tracks two clocks from the same Chrome event log.

| Term | Meaning | Stops when |
|---|---|---|
| **Chrome open** | Chrome is the app in front | You switch to another app, or the screen locks |
| **Active use** | Chrome in front + you recently used mouse/keyboard | Same as above, **or** ~5 min with no input (idle) |

## How we use them (Chrome extension)

- **Header / today total** leads with **Chrome open** — “how long was the browser my foreground app?”
- **Site list, categories, timeline, AI narrative** use **Active use** — “where was my attention?”
- **Site list** also shows **Chrome open** per page when it exceeds active use (passive reading on that page).
- When the gap is large, call it out: “Chrome was open 3h; ~45m was active use.”

## What we do not measure

- Time in other apps
- Background Chrome tabs while another app is in front

## Chrome History (reference)

| **Chrome History** | Every page load Chrome recorded | Reference only — visits, not focus time |

Daily Mirror reads `chrome.history.getVisits` for a **side-by-side alignment** table:

- **History visits** — every load Chrome logged (including background tabs).
- **History est. dwell** — gap until the next page load, capped at 30 minutes per segment. This is a **proxy**, not stored by Chrome.
- Compared against Mirror **active use**, **Chrome open** (per domain), and **navigations**.

Time clocks still come from the event log only. History visit counts are usually higher than Mirror navigations because History includes background loads.

## Likely-automated activity

We flag rapid reloads, query churn, and burst navigation from event shape. These are **heuristics**, not proof that an AI agent drove the tab. We never label Claude, Codex, or Cursor as the initiator.

## Later: multi-device

This doc applies to the **Chrome extension** only. A future macOS + iOS platform can unify one day story across devices using the same two ideas:

- **Active use** — you were interacting
- **Presence** — the app/device was in front (or primary)

Revisit this file when adding those form factors.
