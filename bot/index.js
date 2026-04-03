'use strict';

require('dotenv').config();

const cron = require('node-cron');

const { getTomorrowDate, getTodayDate } = require('./utils/date');
const { isSubscribeChatType } = require('./utils/chat-types');
const { fetchBnmUsdRateForDate } = require('./services/bnm');
const { fetchDxyValue, fetchDxyForDate } = require('./services/dxy');
const { sendTelegramMessage, getTelegramUpdates } = require('./services/telegram');
const { getChatIds, addChatId, removeChatId } = require('./utils/chatIdsStore');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isStartCommand(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  return t === '/start' || t.startsWith('/start ') || t.startsWith('/start@');
}

function formatMessage({ bnmDate, usdRate, dxyValue }) {
  const usdText = usdRate ?? 'Not available yet';
  const dxyText = dxyValue ?? 'Not available yet';

  // Message format: date in title, then BNM + DXY values.
  return `📊 Daily Currency Update — BNM (${bnmDate})\n\nUSD (BNM): ${usdText}\nDXY: ${dxyText}\n\n⏰ Time: 16:05`;
}

function formatHelp() {
  return [
    'Available commands:',
    '',
    '/start - Subscribe to daily updates',
    '/help - Show this help',
    '/today - Get today’s USD (BNM) and current DXY',
    '/tomorrow - Get tomorrow’s USD (BNM) and current DXY',
    '/date DD.MM.YYYY - Get USD (BNM) + DXY for a specific date (best-effort for DXY)',
  ].join('\n');
}

function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const [cmdRaw, ...rest] = trimmed.split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();
  return { cmd, arg };
}

async function runDailyUpdate() {
  // Called by the cron scheduler. Fetches both providers and sends the message
  // to all subscribed users from `data/chat_ids.json`.
  const botToken = getRequiredEnv('BOT_TOKEN');
  const timeZone = 'Europe/Chisinau';
  const tomorrow = getTomorrowDate(timeZone);

  const chatIds = await getChatIds();

  if (!chatIds.length) {
    console.log('[DailyUpdate] No subscribed users yet. Waiting for /start...');
    return;
  }

  console.log(`[DailyUpdate] Fetching rates for tomorrow=${tomorrow}...`);

  const [usdRate, dxyValue] = await Promise.all([
    fetchBnmUsdRateForDate(tomorrow).catch((err) => {
      console.error('[DailyUpdate] Failed to fetch BNM USD rate:', err?.message ?? err);
      return null;
    }),
    fetchDxyValue().catch((err) => {
      console.error('[DailyUpdate] Failed to fetch DXY:', err?.message ?? err);
      return null;
    }),
  ]);

  const text = formatMessage({ bnmDate: tomorrow, usdRate, dxyValue });

  await Promise.allSettled(
    chatIds.map(async (chatId) => {
      try {
        await sendTelegramMessage({ botToken, chatId, text });
        console.log(`[DailyUpdate] Message sent to chatId=${chatId}`);
      } catch (err) {
        const msg = String(err?.message ?? err).toLowerCase();
        console.error(`[DailyUpdate] Failed to send to chatId=${chatId}:`, err?.message ?? err);

        // If Telegram says the chat is gone / bot is blocked,
        // remove it from storage so we don't keep failing daily.
        if (msg.includes('bot was blocked') || msg.includes('forbidden') || msg.includes('chat not found')) {
          const removed = await removeChatId(chatId);
          if (removed) console.log(`[DailyUpdate] Removed invalid chatId=${chatId} from storage.`);
        }
      }
    })
  );
}

function startScheduler() {
  // Schedule: 16:05 local time in Europe/Chisinau (cron expression "5 16 * * *").
  const timeZone = 'Europe/Chisinau';
  cron.schedule('5 16 * * *', () => {
    runDailyUpdate().catch((err) => {
      console.error('[DailyUpdate] Unhandled error:', err?.message ?? err);
    });
  }, { timezone: timeZone });
}

async function startPolling() {
  // Subscription: poll `getUpdates`; on `/start` in private chat or group, store `chat.id`.
  const botToken = getRequiredEnv('BOT_TOKEN');
  console.log('[Polling] Starting Telegram polling (listening for /start in DM or groups)...');

  let offset = 0;
  while (true) {
    try {
      const updates = await getTelegramUpdates({ botToken, offset, timeoutSeconds: 30 });
      for (const upd of updates) {
        offset = (upd.update_id ?? offset) + 1;

        const msg = upd?.message ?? upd?.edited_message;
        const chatId = msg?.chat?.id;
        const chatType = msg?.chat?.type;
        if (!chatId) continue;
        if (!isSubscribeChatType(chatType)) continue;

        const text = msg?.text;
        const parsed = parseCommand(text);
        if (!parsed) continue;

        if (isStartCommand(text)) {
          const added = await addChatId(chatId);
          if (added) console.log(`[Polling] Subscribed chatId=${chatId} via /start.`);
          await sendTelegramMessage({ botToken, chatId, text: 'Subscribed. Use /help to see commands.' });
          continue;
        }

        if (parsed.cmd === '/help') {
          await sendTelegramMessage({ botToken, chatId, text: formatHelp() });
          continue;
        }

        if (parsed.cmd === '/today') {
          const bnmDate = getTodayDate('Europe/Chisinau');
          const [usdRate, dxyValue] = await Promise.all([
            fetchBnmUsdRateForDate(bnmDate).catch(() => null),
            fetchDxyValue().catch(() => null),
          ]);
          await sendTelegramMessage({ botToken, chatId, text: formatMessage({ bnmDate, usdRate, dxyValue }) });
          continue;
        }

        if (parsed.cmd === '/tomorrow') {
          const bnmDate = getTomorrowDate('Europe/Chisinau');
          const [usdRate, dxyValue] = await Promise.all([
            fetchBnmUsdRateForDate(bnmDate).catch(() => null),
            fetchDxyValue().catch(() => null),
          ]);
          await sendTelegramMessage({ botToken, chatId, text: formatMessage({ bnmDate, usdRate, dxyValue }) });
          continue;
        }

        if (parsed.cmd === '/date') {
          const bnmDate = parsed.arg;
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(bnmDate)) {
            await sendTelegramMessage({
              botToken,
              chatId,
              text: 'Invalid date format. Use: /date DD.MM.YYYY (example: /date 03.04.2026)',
            });
            continue;
          }

          const usdRate = await fetchBnmUsdRateForDate(bnmDate).catch(() => null);
          const dxyHistorical = await fetchDxyForDate(bnmDate).catch(() => null);
          const dxyValue = dxyHistorical ?? (await fetchDxyValue().catch(() => null));

          await sendTelegramMessage({ botToken, chatId, text: formatMessage({ bnmDate, usdRate, dxyValue }) });
          continue;
        }
      }
    } catch (err) {
      console.error('[Polling] Error:', err?.message ?? err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  console.log('[Startup] Starting cron scheduler...');
  startScheduler();

  console.log('[Startup] Starting polling...');
  await startPolling(); // runs forever
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Startup] Failed:', err?.message ?? err);
    process.exitCode = 1;
  });
}

module.exports = { runDailyUpdate, startScheduler, startPolling };

