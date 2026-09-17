# OmniRoute Usage — Hermes Desktop Plugin

🌏 README in [ภาษาไทย](README.md)

Monitor usage summary, connection quotas, and recent call logs from [OmniRoute](https://github.com/danny-avila/OmniRoute) inside Hermes Desktop (Read-only, Thai UI).

## Features

- **Status Bar Chip:** Shows 1-day summary of requests and cost (polls every 30s)
- **Chip Popup:** Quick 1-day metrics + tokens + shortcut buttons to open dashboard or trigger manual refresh
- **Dashboard Page (`/omniroute`):**
  - Hero summary metrics (Requests, Tokens, Cost)
  - Connection Quotas Table (Rate limits, remaining quota, reset time)
  - Recent Call Logs (Latest 20 calls with status, latency, token count)
- **⌘K Command Palette:**
  - `OmniRoute: เปิดหน้า Usage` (Open usage page)
  - `OmniRoute: รีเฟรชข้อมูล` (Refresh data)
  - `OmniRoute: ลบ accessToken` (Clear stored token)

## Installation

**Install from Git** via Settings → Plugins with this repository: `Manchinn/hermes-omniroute`
Or click:

```
hermes://plugin/install?repo=Manchinn/hermes-omniroute&enable=1
```

(The deep link opens a confirmation dialog in Hermes Desktop)

After installation, the plugin file will be placed at `desktop-plugins/hermes-omniroute/plugin.js`.
Enable it in Settings → Plugins → **OmniRoute** (Opt-in by default).

> Tokens are securely stored in the application's internal storage (`ctx.storage`) bound to the plugin ID.
> Reinstalling or updating the plugin retains your configured token.

## Usage

1. Navigate to **OmniRoute** from the sidebar or Command Palette (`Cmd/Ctrl+K`).
2. Enter your OmniRoute **accessToken** (found in OmniRoute's `config.json`).
3. Metrics will immediately load from `http://localhost:20128`.

## Privacy & Security

- **Local-Only:** Directly queries your local OmniRoute instance (`http://localhost:20128`). No analytics or remote calls.
- **Strictly Read-Only:** Queries read-only statistics; never modifies OmniRoute configurations or stored keys.
- **No Token Leaks:** Tokens reside strictly in local storage and never leave your machine.

## Files

| File | Description |
| --- | --- |
| `plugin.js` | Single-file plugin (Zero build step required) |
| `README.md` | Thai documentation |
| `README.en.md` | English documentation |
| `LICENSE` | MIT License |

## SDK Reference

Built using `@hermes/plugin-sdk` (`react`, `react/jsx-runtime`).
Documentation: https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk

MIT License.
