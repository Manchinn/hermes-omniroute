# OmniRoute Usage — Hermes Desktop Plugin

🌏 README in [ไทย](README.md)

View usage summary, provider limits per connection, and recent call logs from [OmniRoute](https://github.com/danny-avila/OmniRoute) inside Hermes Desktop. Read-only plugin with full bilingual support (English / Thai).

## Features

- **Status Bar Chip:** Displays 1-day summary of requests / cost (polls every 30s)
- **Chip Popup:** Instant summary + tokens + buttons to open full page or refresh
- **Language Switcher:** Quick `[ Auto | EN | TH ]` toggle at the top right
- **Full Page `/omniroute`:**
  - Hero summary (Requests, Tokens, Cost, Success rate, Latency)
  - Provider Limits Table (Rate limits, remaining %, reset countdown, live upstream sync)
  - Recent Call Logs (Last 20 requests with status badge, latency, tokens, errors)
- **⌘K Palette Commands:**
  - `OmniRoute: Open Usage Page`
  - `OmniRoute: Refresh Data`
  - `OmniRoute: Clear accessToken`

## Installation

**Install from Git** (Settings → Plugins) with repo: `Manchinn/hermes-omniroute`,
or click:

```
hermes://plugin/install?repo=Manchinn/hermes-omniroute&enable=1
```

(The link opens the confirm dialog — it never auto-installs.)

After install the file lands at `desktop-plugins/hermes-omniroute/plugin.js`
— folder name is the repo name, while the plugin `id` inside is `omniroute-usage`.
Then enable **OmniRoute Usage** in Settings → Plugins (ships opt-in: `defaultEnabled: false`).

> Tokens are not in that folder — they live in the app's per-plugin storage keyed by `id`, so reinstall/delete keeps them safely.

## Usage

1. Open the **OmniRoute** page from the sidebar or Palette (⌘K).
2. Toggle your preferred language (Auto/EN/TH) at the top right.
3. Add your **accessToken** (Management Bearer token from OmniRoute `config.json`).
4. Data is fetched automatically from `http://localhost:20128`.
