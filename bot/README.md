# Telegram Daily Currency Bot (BNM USD + DXY)

This bot sends a daily Telegram message at **16:05** in the **Europe/Chisinau** timezone with:

- **USD** exchange rate from the National Bank of Moldova (BNM) for **tomorrow**
- **DXY** (US Dollar Index) current value

## Subscription model (DM multi-user)

Users subscribe by sending **`/start`** to the bot in a DM.
The bot stores each user's `chat_id` in `data/chat_ids.json` and includes them in the daily updates.

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

For DM multi-user, just send **`/start`** to the bot.
The bot will automatically store your `chat_id`.

## Run locally

```bash
npm run start
```

The bot starts:
- polling (`getUpdates`) to capture `/start` in DM
- scheduling (daily at 16:05 Europe/Chisinau)

## Deploy to Fly.io (no code changes)

This bot is a long-running process (polling + daily schedule), so you should deploy it as an always-on app.

### 1) Install `flyctl`

On Linux:

```bash
curl -L https://fly.io/install.sh | sh
```

Then ensure `flyctl` is in your `PATH` (you may need to restart the shell).

### 2) Login

```bash
fly auth login
```

### 3) Launch the app from the `bot/` folder

```bash
cd /var/www/sergiusticiffw.github.io/bot
fly launch
```

Suggested answers:
- App name: any unique name
- Region: choose something close (e.g. `waw` / `otp`)
- Deploy now: yes

### 4) Set secrets (required)

```bash
fly secrets set BOT_TOKEN="PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE"
```

### 5) Deploy updates

Whenever you update the code:

```bash
fly deploy
```

If Fly cannot detect your app automatically (or you have multiple apps), use:

```bash
fly apps list
fly deploy -a YOUR_APP_NAME
```

To check status and logs:

```bash
fly status
fly logs
```

### 6) Keep it running

If you're on a free tier that can stop/sleep VMs, the bot may stop polling and miss the daily schedule.
Make sure the Fly app is configured to keep at least 1 machine running.

## Notes

- If BNM data is missing, the message shows **`Not available yet`** for USD.
- If DXY/Telegram calls fail, the bot logs the error but keeps running.

## BNM date format (important)

BNM's XML endpoint expects the `date` parameter in **`DD.MM.YYYY`** format (for example: `03.04.2026`).

