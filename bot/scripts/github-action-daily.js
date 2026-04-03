'use strict';

const fs = require('fs');
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

/**
 * GitHub scheduled jobs often start late. Window 16:15–17:45 Europe/Chisinau (minutes inclusive).
 */
function shouldSendScheduledWindow({ timeZone }) {
  const p = nowInTimeZoneParts(timeZone);
  const todayKey = `${p.yyyy}-${p.mm}-${p.dd}`;
  const hh = Number(p.hh);
  const min = Number(p.min);
  if (!Number.isFinite(hh) || !Number.isFinite(min)) {
    return { ok: false, todayKey, reason: 'invalid_local_time' };
  }
  const t = hh * 60 + min;
  const start = 16 * 60 + 15;
  const end = 17 * 60 + 45;
  if (t < start || t > end) {
    return { ok: false, todayKey, reason: 'outside_send_window' };
  }
  return { ok: true, todayKey, reason: 'send_scheduled_window' };
}

function readDedupDateKey(filePath) {
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function writeDedupDateKey(filePath, todayKey) {
  if (!filePath || !todayKey) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${todayKey}\n`, 'utf8');
}

function isTrue(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

async function main() {
  const botToken = requiredEnv('BOT_TOKEN');
  const timeZone = 'Europe/Chisinau';
  const forceSend = isTrue(process.env.FORCE_SEND);
  const eventName = String(process.env.GA_EVENT_NAME ?? '').trim() || 'unknown';
  const dedupFile = String(process.env.TELEGRAM_DEDUP_FILE ?? '').trim();

  const recipientChatIds = parseChatIdsFromEnv(process.env.CHAT_IDS);
  console.log(`[GA] Workflow event: ${eventName}`);
  console.log(
    forceSend
      ? '[GA] Mode: force send (skipping local time window)'
      : '[GA] Mode: scheduled send (window 16:15–17:45 Europe/Chisinau; tolerates GitHub delay)'
  );
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
    : shouldSendScheduledWindow({ timeZone });

  if (forceSend) {
    console.log('[GA] Time check: skipped (force send)');
  } else {
    console.log('[GA] Time check (scheduled window 16:15–17:45 local):', sendDecision);
  }

  if (!sendDecision.ok) {
    console.log('[GA] Exit — scheduled send: outside 16:15–17:45 local window, no message sent.');
    return;
  }

  if (!forceSend && dedupFile) {
    const prior = readDedupDateKey(dedupFile);
    if (prior && prior === sendDecision.todayKey) {
      console.log('[GA] Exit — scheduled send: already sent today (dedup), skipping duplicate.');
      return;
    }
  }

  if (!recipientChatIds.length) {
    console.log('[GA] No CHAT_IDS — skipping send. Set secret CHAT_IDS (comma-separated ids).');
    return;
  }

  console.log(forceSend ? '[GA] Delivering: force send' : '[GA] Delivering: scheduled send (in window)');

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
    if (!forceSend && dedupFile) {
      writeDedupDateKey(dedupFile, sendDecision.todayKey);
      console.log('[GA] Dedup marker saved for', sendDecision.todayKey);
    }
  }
}

main().catch((err) => {
  console.error('[GA] Failed:', err?.message ?? err);
  process.exitCode = 1;
});
