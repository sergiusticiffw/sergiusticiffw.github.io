'use strict';

/**
 * Local smoke test: load .env, fetch BNM (tomorrow) + DXY.
 * Use --send to push a short Telegram message to CHAT_IDS ∪ data/chat_ids.json.
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { getTomorrowDate } = require('../utils/date');
const { fetchBnmUsdRateForDate } = require('../services/bnm');
const { fetchDxyValue } = require('../services/dxy');
const { sendTelegramMessage } = require('../services/telegram');
const { mergeRecipientChatIds } = require('../utils/chat-ids-env');
const { getChatIds } = require('../utils/chatIdsStore');

async function main() {
  const send = process.argv.includes('--send');

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('[smoke] Missing BOT_TOKEN in bot/.env');
    process.exit(1);
  }

  const timeZone = 'Europe/Chisinau';
  const bnmDate = getTomorrowDate(timeZone);

  console.log(`[smoke] BNM date (tomorrow, ${timeZone}): ${bnmDate}`);
  console.log('[smoke] Fetching BNM + DXY...');

  const [usdRate, dxyValue] = await Promise.all([
    fetchBnmUsdRateForDate(bnmDate).catch((err) => {
      console.error('[smoke] BNM error:', err?.message ?? err);
      return null;
    }),
    fetchDxyValue().catch((err) => {
      console.error('[smoke] DXY error:', err?.message ?? err);
      return null;
    }),
  ]);

  console.log(`[smoke] USD (BNM): ${usdRate ?? 'N/A'}`);
  console.log(`[smoke] DXY: ${dxyValue ?? 'N/A'}`);

  if (!send) {
    console.log('[smoke] OK (providers).');
    console.log('[smoke] No Telegram message was sent (this command never sends).');
    console.log('[smoke] To send a test message: npm run test:local:send');
    return;
  }

  const stored = await getChatIds();
  const recipients = mergeRecipientChatIds(stored, process.env.CHAT_IDS);

  if (!recipients.length) {
    console.error('[smoke] --send: set CHAT_IDS in .env and/or subscribe via /start (data/chat_ids.json).');
    process.exit(1);
  }

  const rawChatIds = process.env.CHAT_IDS;
  if (!rawChatIds || !String(rawChatIds).trim()) {
    console.warn('[smoke] CHAT_IDS is missing or empty in .env — using only data/chat_ids.json.');
  }

  console.log(`[smoke] Sending to ${recipients.length} chat(s): ${recipients.join(', ')}`);

  const text =
    `✅ Smoke test\nBNM ${bnmDate}: ${usdRate ?? 'N/A'}\nDXY: ${dxyValue ?? 'N/A'}`;

  let failed = 0;
  for (const chatId of recipients) {
    try {
      await sendTelegramMessage({ botToken, chatId, text });
      console.log(`[smoke] Sent to chat_id=${chatId}`);
    } catch (err) {
      failed += 1;
      const msg = String(err?.message ?? err);
      console.error(`[smoke] Failed chat_id=${chatId}:`, msg);
      if (/chat not found|chat_id is empty|PEER_ID_INVALID/i.test(msg)) {
        console.error(
          '[smoke] Hint: wrong id, or that user never opened the bot and sent /start. Channel/supergroup ids look like -100…'
        );
      }
    }
  }

  if (failed) {
    console.error(`[smoke] ${failed}/${recipients.length} sends failed. Fix chat ids or have each user /start the bot.`);
    process.exit(1);
  }

  console.log('[smoke] OK (Telegram).');
}

main().catch((err) => {
  console.error('[smoke] Failed:', err?.message ?? err);
  process.exit(1);
});
