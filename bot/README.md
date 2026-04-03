# Telegram Daily Currency Bot (BNM USD + DXY)

This bot sends a daily Telegram message at **16:05** **Europe/Chisinau**. On **GitHub Actions**, the workflow is scheduled **twice per day in UTC** (13:05 and 14:05 UTC) so one of them lines up with 16:05 local time in summer vs winter; the script sends only when the machine’s local time in that timezone is exactly **16:05**, and **at most once per day**. The message includes:

- **USD** exchange rate from the National Bank of Moldova (BNM) for **tomorrow**
- **DXY** (US Dollar Index) current value

## Subscription model (private, groups, channels)

Users subscribe by sending **`/start`** to the bot in a **private chat**, **group/supergroup**, or (if the bot posts in a **channel**) via a **`/start`** as a **channel post** where the bot is admin.

**Channels:** posting the daily message to a channel usually needs the channel id (often like `-100…`). Add the bot as **administrator** with permission to post messages, then put that id in the **`CHAT_IDS`** secret (see below) — `/start` alone often does not appear in `getUpdates` the same way as in groups.

The bot stores each auto-detected `chat_id` in `data/chat_ids.json` (local) or in the GitHub issue state (Actions). **`CHAT_IDS`** (env / GitHub secret) is **merged** at send time with those lists and is **not** written into the issue.

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
- scheduling (daily at 16:05 Europe/Chisinau)

## 100% free mode: GitHub Actions (no VPS)

If you want this bot to run for free without a server, you can use GitHub Actions:

- The workflow runs **twice daily at fixed UTC times** (see `.github/workflows/telegram-daily-bot.yml`); **Telegram is sent only at 16:05 Europe/Chisinau**, once per calendar day. New `/start` subscribers are picked up on the next scheduled run (or use **Run workflow**).
- It also polls Telegram updates during each run to collect new `/start` subscribers.
- Subscribers and offsets are stored in a GitHub Issue titled **`telegram-bot-subscribers`**.

### 1) Add secrets

In your GitHub repo:

1. Go to **Settings → Secrets and variables → Actions**
2. Add **Repository secrets** (or use an **Environment** — see below):
   - **`BOT_TOKEN`** — your Telegram bot token
   - **`CHAT_IDS`** (optional) — extra recipients, comma- or space-separated numeric ids, e.g. `-1001234567890,359559808`. Merged with subscribers from the `telegram-bot-subscribers` issue on every run.

**Environment secrets:** create an environment under **Settings → Environments** (e.g. `telegram-bot`), add `BOT_TOKEN` and/or `CHAT_IDS` there, then in `.github/workflows/telegram-daily-bot.yml` set `environment: telegram-bot` on the `run` job (see the commented line in the workflow).

### 2) Enable Actions

Ensure GitHub Actions are enabled for the repository.

### 3) Subscribe users

Users open a DM with the bot (or add it to a group) and send:

```text
/start
```

The next workflow run will pick it up and store the `chat_id`.

### 4) Run manually (optional)

In GitHub → Actions → **Telegram Daily Currency Bot** → Run workflow.

You can also set `force_send=true` to send immediately (for testing), without waiting for 16:05.

## Notes

- If BNM data is missing, the message shows **`Not available yet`** for USD.
- If DXY/Telegram calls fail, the bot logs the error but keeps running.

## BNM date format (important)

BNM's XML endpoint expects the `date` parameter in **`DD.MM.YYYY`** format (for example: `03.04.2026`).

