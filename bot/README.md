# Telegram Daily Currency Bot (BNM USD + DXY)

This bot sends a daily Telegram message at **16:15** **Europe/Chisinau** (nominal). On **GitHub Actions**, scheduled runs use a **local window 16:15–17:45** to tolerate GitHub start delays, plus a **cache-backed dedup** so the two daily UTC crons do not send twice the same calendar day. **Push** / **`force_send`** skip the window and do not write the dedup marker. Recipients on Actions come only from the **`CHAT_IDS`** secret. The message includes:

- **USD** exchange rate from the National Bank of Moldova (BNM) for **tomorrow**
- **DXY** (US Dollar Index) current value

## Subscription model (private, groups, channels)

Users subscribe by sending **`/start`** to the bot in a **private chat**, **group/supergroup**, or (if the bot posts in a **channel**) via a **`/start`** as a **channel post** where the bot is admin.

**Channels:** add the bot as **administrator** (post messages) and put the channel **`chat_id`** (often `-100…`) in **`CHAT_IDS`**.

**Local run (`npm run start`):** `/start` stores `chat_id` in **`data/chat_ids.json`**; optional **`CHAT_IDS`** in `.env` is merged at send time. **GitHub Actions** does not use that file — only the **`CHAT_IDS`** secret.

## Bot menu (Telegram commands)

To add a command menu in Telegram:

1. Open **@BotFather**
2. Run `/setcommands`
3. Select your bot
4. Paste:

```text
start - Subscribe to daily updates
help - Show available commands
today - Get today's USD (BNM) and current DXY
tomorrow - Get tomorrow's USD (BNM) and current DXY
date - Get USD (BNM) and DXY for a specific date (DD.MM.YYYY)
```

## Requirements

- Node.js 20+ (latest LTS)
- `BOT_TOKEN` in `.env`

## Get a Telegram bot token (BotFather)

1. Open Telegram and search for **@BotFather**
2. Start the chat and run `/start`
3. Use `/newbot`
4. Follow instructions to obtain the token (it looks like `123456789:ABCDEF...`)

## Setup

```bash
cd /var/www/sergiusticiffw.github.io/bot
npm install
cp .env.example .env
```

Edit `.env`:

```bash
BOT_TOKEN=PUT_TELEGRAM_BOT_TOKEN_HERE
```

## How to get `chat_id`

### Recommended (no manual work)

Send **`/start`** in a DM or in the group where you want the daily message.
The bot will automatically store your `chat_id`.

## Run locally

```bash
npm run start
```

### Quick test (no GitHub, no cron)

From `bot/` with `BOT_TOKEN` (and optional `CHAT_IDS`) in `.env`:

```bash
npm run test:local       # only BNM + DXY fetch; prints values
npm run test:local:send  # same + sends a short Telegram to CHAT_IDS and/or data/chat_ids.json
```

The bot starts:
- polling (`getUpdates`) to capture `/start` in DM, groups, or channel posts
- scheduling (daily at 16:15 Europe/Chisinau)

## 100% free mode: GitHub Actions (no VPS)

The workflow only needs **`BOT_TOKEN`** and **`CHAT_IDS`** (no GitHub Issues, no stored subscriber state).

- **Push to `main`:** each push runs the job with **`FORCE_SEND=true`** (sends immediately if `CHAT_IDS` is set), so you can verify the bot after deploys.
- **Schedule:** **twice daily UTC** (DST-safe). Sends during **16:15–17:45 Europe/Chisinau** once per day (`actions/cache` dedup). **`FORCE_SEND` off** for schedule.
- **`CHAT_IDS`**: comma / space / semicolon separated numeric ids (e.g. `-1001234567890,359559808`). Update the secret when recipients change.

### 1) Secrets

**Settings → Secrets and variables → Actions** — add:

- **`BOT_TOKEN`**
- **`CHAT_IDS`** (required for scheduled sends; empty list skips send)

You can use **Environment** secrets instead: create an environment, add the same names, and set `environment: <name>` on the `run` job in the workflow file.

### 2) Enable Actions

Ensure Actions are enabled for the repository.

### 3) Run manually

**Actions → Telegram Daily Currency Bot → Run workflow**. Use **`force_send=true`** to test immediately (ignores the 16:15–17:45 window).

## Notes

- If BNM data is missing, the message shows **`Not available yet`** for USD.
- If DXY/Telegram calls fail, the bot logs the error but keeps running.

## BNM date format (important)

BNM's XML endpoint expects the `date` parameter in **`DD.MM.YYYY`** format (for example: `03.04.2026`).

