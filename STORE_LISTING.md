# Chrome Web Store — Listing & Review Notes

Working draft of everything needed to submit Daily Mirror. Expect **manual review**
(1–3 weeks) because the extension requests `history` plus a host permission.

## Listing copy

**Name:** Daily Mirror — Activity Analyzer

**Short description (≤132 chars):**
> A private, on-device mirror of your day. Measures real time-on-site and writes you an honest AI narrative against your goals.

**Category:** Productivity

**Detailed description:**
> Daily Mirror is a calm, private look at how you actually spend your day online — not a team
> time-tracker, not surveillance. It runs entirely in your browser.
>
> • **Measured time, not guesses.** It records real active time per site (idle time excluded),
>   stored locally in your browser. Nothing is sent to any server we run — we don't run one.
> • **A daily narrative.** On demand, it bundles your day and — using *your own* OpenRouter API
>   key — asks an AI model to write a short, honest summary plus one observation.
> • **Goal-aware.** Tell it what you're trying to focus on this week, and the summary compares
>   your intent to how the time actually went.
> • **Private by design.** No accounts, no analytics, no cloud sync. Your activity never leaves
>   your device except the summary request you initiate, which goes straight to the AI provider
>   you chose.
>
> Bring your own OpenRouter API key (openrouter.ai). Free to use.

## Privacy

- **Privacy policy URL:** host `extension/privacy.html` somewhere public (e.g. GitHub Pages) and
  paste that URL. The same page is bundled in the extension and linked from the popup.
- **Single purpose:** "Give the user a private, on-device summary of how they spend time online."
- **Data usage disclosures (Web Store form):**
  - Does the extension collect user data? → *Web history* and *Website content* (URLs/titles),
    but it is **stored locally** and **not transmitted to the developer**.
  - Sold to third parties: **No.**
  - Used/transferred for purposes unrelated to core function: **No.**
  - Used to determine creditworthiness / lending: **No.**
  - The only transfer is user-initiated, to the user's chosen AI provider (OpenRouter), using the
    user's own key.

## Permission justifications (paste into the review form)

- **history** — "Reads the user's own browsing history to build a private, on-device daily
  activity summary. It is never transmitted to any server we operate (we operate none)."
- **tabs** — "Detects the active tab and its URL/title to measure real time-on-site locally."
- **idle** — "Stops counting time when the user is idle or the screen is locked, so the measured
  time is honest."
- **storage** — "Stores the user's settings (their own API key, model, goals) locally on the
  device."
- **host_permissions: https://openrouter.ai/** — "The only outbound request: sends the day's
  activity to the AI provider the user configured, using the user's own API key, to generate the
  summary. Nothing is sent anywhere else."

## Pre-submission checklist

- [ ] Build the dashboard: `cd extension/dashboard && npm install && npm run build`.
- [ ] Confirm `extension/dashboard/dist/` exists (it is loaded at runtime).
- [ ] Bump `version` in `extension/manifest.json`.
- [ ] Provide 1280×800 (or 640×400) screenshots of the dashboard and popup.
- [ ] Provide a 128×128 store icon (icons already in `extension/icons/`).
- [ ] Host the privacy policy and paste its URL.
- [ ] Zip the **contents** of `extension/` (must include `dashboard/dist/`) and upload.

## Packaging

```bash
cd extension/dashboard && npm ci && npm run build
cd ..                      # now in extension/
zip -r ../daily-mirror.zip . -x "dashboard/node_modules/*" "dashboard/src/*" \
  "dashboard/*.js" "dashboard/*.json" "dashboard/index.html" "dashboard/postcss.config.js" \
  "dashboard/tailwind.config.js" "dashboard/vite.config.js"
# Keep dashboard/dist/, drop dashboard source/build tooling from the package.
```
