'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const axios = require('axios');

const { getTomorrowDate } = require('../utils/date');
const { fetchBnmUsdRateForDate } = require('../services/bnm');
const { fetchDxyValue } = require('../services/dxy');
const { sendTelegramMessage } = require('../services/telegram');
const { parseChatIdsFromEnv } = require('../utils/chat-ids-env');

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const botToken = requiredEnv('BOT_TOKEN');
  const timeZone = 'Europe/Chisinau';
  const eventName = String(process.env.GA_EVENT_NAME ?? '').trim() || 'unknown';

  const recipientChatIds = parseChatIdsFromEnv(process.env.CHAT_IDS);

  console.log(`[GA] Workflow event: ${eventName}`);
  console.log(`[GA] CHAT_IDS → ${recipientChatIds.length} recipient(s)`);

  try {
    await axios.get(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      params: { drop_pending_updates: false },
      timeout: 20000,
    });
  } catch (err) {
    console.error('[GA] deleteWebhook failed (continuing):', err?.message ?? err);
  }

  if (!recipientChatIds.length) {
    console.log('[GA] No CHAT_IDS — skipping send. Set secret CHAT_IDS (comma-separated ids).');
    return;
  }

  const bnmDate = getTomorrowDate(timeZone);
  const [usdRate, dxyValue] = await Promise.all([
    fetchBnmUsdRateForDate(bnmDate).catch(() => null),
    fetchDxyValue().catch(() => null),
  ]);

  const usdText = usdRate ?? 'Not available yet';
  const dxyText = dxyValue ?? 'Not available yet';
  const text =
    `📊 Daily Currency Update — BNM (${bnmDate})\n\n` +
    `USD (BNM): ${usdText}\n` +
    `DXY: ${dxyText}\n\n` +
    `⏰ Time: 16:15`;

  console.log(`[GA] Sending to ${recipientChatIds.length} chat(s)...`);
  const results = await Promise.allSettled(
    recipientChatIds.map((chatId) => sendTelegramMessage({ botToken, chatId, text }))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    failed.forEach((r) => {
      console.error('[GA] Send error:', r.reason?.message ?? r.reason);
    });
    console.error(`[GA] Send failures: ${failed.length}/${results.length}`);
    process.exitCode = 1;
  } else {
    console.log('[GA] All messages sent successfully.');
  }
}

main().catch((err) => {
  console.error('[GA] Failed:', err?.message ?? err);
  process.exitCode = 1;
});
