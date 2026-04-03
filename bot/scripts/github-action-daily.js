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

function nowInTimeZoneParts(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    yyyy: get('year'),
    mm: get('month'),
    dd: get('day'),
    hh: get('hour'),
    min: get('minute'),
  };
}

function todayKeyInTimeZone(timeZone) {
  const p = nowInTimeZoneParts(timeZone);
  return `${p.yyyy}-${p.mm}-${p.dd}`;
}

/** Send only when Europe/Chisinau clock is exactly 16:15 (workflow uses matching UTC crons). */
function shouldSendNow({ timeZone, targetHour = '16', targetMinute = '15' }) {
  const p = nowInTimeZoneParts(timeZone);
  const todayKey = `${p.yyyy}-${p.mm}-${p.dd}`;
  const isTarget = p.hh === targetHour && p.min === targetMinute;
  if (!isTarget) {
    return { ok: false, todayKey, reason: 'not_16_15_local' };
  }
  return { ok: true, todayKey, reason: 'send_16_15' };
}

function isTrue(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

async function main() {
  const botToken = requiredEnv('BOT_TOKEN');
  const timeZone = 'Europe/Chisinau';
  const forceSend = isTrue(process.env.FORCE_SEND);

  const recipientChatIds = parseChatIdsFromEnv(process.env.CHAT_IDS);
  console.log(`[GA] CHAT_IDS → ${recipientChatIds.length} recipient(s)`);

  try {
    await axios.get(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      params: { drop_pending_updates: false },
      timeout: 20000,
    });
  } catch (err) {
    console.error('[GA] deleteWebhook failed (continuing):', err?.message ?? err);
  }

  const sendDecision = forceSend
    ? { ok: true, todayKey: todayKeyInTimeZone(timeZone), reason: 'force_send' }
    : shouldSendNow({ timeZone, targetHour: '16', targetMinute: '15' });

  console.log('[GA] Time check:', sendDecision);

  if (!sendDecision.ok) {
    console.log('[GA] Exit (no send this run).');
    return;
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
