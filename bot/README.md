# Telegram Daily Currency Bot (BNM USD + DXY)

This bot sends a daily Telegram message at **16:05** in the **Europe/Chisinau** timezone with:

- **USD** exchange rate from the National Bank of Moldova (BNM) for **tomorrow**
- **DXY** (US Dollar Index) current value

## Subscription model (DM multi-user)

Users subscribe by sending **`/start`** to the bot in a DM.
The bot stores each user's `chat_id` in `data/chat_ids.json` and includes them in the daily updates.

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

For DM multi-user, just send **`/start`** to the bot.
The bot will automatically store your `chat_id`.

## Run locally

```bash
npm run start
```

The bot starts:
- polling (`getUpdates`) to capture `/start` in DM
- scheduling (daily at 16:05 Europe/Chisinau)

## Notes

- If BNM data is missing, the message shows **`Not available yet`** for USD.
- If DXY/Telegram calls fail, the bot logs the error but keeps running.

## BNM date format (important)

BNM's XML endpoint expects the `date` parameter in **`DD.MM.YYYY`** format (for example: `03.04.2026`).

