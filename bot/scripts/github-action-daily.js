'use strict';

const axios = require('axios');

const { getTomorrowDate } = require('../utils/date');
const { isSubscribeChatType } = require('../utils/chat-types');
const { fetchBnmUsdRateForDate } = require('../services/bnm');
const { fetchDxyValue } = require('../services/dxy');
const { sendTelegramMessage, getMessageLikeFromUpdate } = require('../services/telegram');
const { mergeRecipientChatIds, parseChatIdsFromEnv } = require('../utils/chat-ids-env');

const STATE_TITLE = 'telegram-bot-subscribers';
const STATE_MARKER_START = '<!-- BOT_STATE_START -->';
const STATE_MARKER_END = '<!-- BOT_STATE_END -->';

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

/** Send once per calendar day in `timeZone`, only when local clock is exactly target hour:minute. */
function shouldSendNow({
  timeZone,
  targetHour = '16',
  targetMinute = '05',
  lastSentDateKey,
}) {
  const p = nowInTimeZoneParts(timeZone);
  const todayKey = `${p.yyyy}-${p.mm}-${p.dd}`;
  const isTarget = p.hh === targetHour && p.min === targetMinute;
  if (!isTarget) {
    return { ok: false, todayKey, reason: 'not_16_05_local' };
  }
  if (lastSentDateKey === todayKey) {
    return { ok: false, todayKey, reason: 'already_sent_today' };
  }
  return { ok: true, todayKey, reason: 'send_16_05' };
}

function isTrue(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function parseStartCommand(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  return t === '/start' || t.startsWith('/start ') || t.startsWith('/start@');
}

function extractStateFromIssueBody(body) {
  const defaultState = { chatIds: [], lastUpdateId: 0, lastSentDateKey: null };
  if (!body) return defaultState;

  const start = body.indexOf(STATE_MARKER_START);
  const end = body.indexOf(STATE_MARKER_END);
  if (start === -1 || end === -1 || end <= start) return defaultState;

  const jsonText = body.slice(start + STATE_MARKER_START.length, end).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return {
      chatIds: Array.isArray(parsed.chatIds) ? [...new Set(parsed.chatIds.map(Number).filter(Number.isFinite))] : [],
      lastUpdateId: Number.isFinite(Number(parsed.lastUpdateId)) ? Number(parsed.lastUpdateId) : 0,
      lastSentDateKey: typeof parsed.lastSentDateKey === 'string' ? parsed.lastSentDateKey : null,
    };
  } catch {
    return defaultState;
  }
}

function buildIssueBody(state) {
  const payload = {
    chatIds: [...new Set(state.chatIds)].sort((a, b) => a - b),
    lastUpdateId: state.lastUpdateId ?? 0,
    lastSentDateKey: state.lastSentDateKey ?? null,
  };

  return [
    'This issue stores Telegram bot state for GitHub Actions.',
    '',
    STATE_MARKER_START,
    JSON.stringify(payload, null, 2),
    STATE_MARKER_END,
    '',
  ].join('\n');
}

async function githubRequest(method, url, { token, data, params } = {}) {
  const res = await axios.request({
    method,
    url,
    data,
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 20000,
  });
  return res.data;
}

async function getOrCreateStateIssue({ owner, repo, githubToken }) {
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const issues = await githubRequest('GET', listUrl, {
    token: githubToken,
    params: { state: 'open', per_page: 100 },
  });

  const existing = issues.find((i) => i && i.title === STATE_TITLE);
  if (existing) return existing;

  const createUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const created = await githubRequest('POST', createUrl, {
    token: githubToken,
    data: { title: STATE_TITLE, body: buildIssueBody({ chatIds: [], lastUpdateId: 0, lastSentDateKey: null }) },
  });
  return created;
}

async function updateIssueBody({ owner, repo, issueNumber, githubToken, body }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  return githubRequest('PATCH', url, { token: githubToken, data: { body } });
}

async function getTelegramUpdates(botToken, offset, timeoutSeconds = 0) {
  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const { data } = await axios.get(url, {
    params: { offset, timeout: timeoutSeconds },
    timeout: 20000,
  });
  if (!data?.ok) throw new Error(`getUpdates failed: ${JSON.stringify(data)}`);
  return data?.result ?? [];
}

async function main() {
  const botToken = requiredEnv('BOT_TOKEN');
  const githubToken = requiredEnv('GITHUB_TOKEN');
  const repoFull = requiredEnv('GITHUB_REPOSITORY'); // owner/repo
  const [owner, repo] = repoFull.split('/');
  const timeZone = 'Europe/Chisinau';
  const forceSend = isTrue(process.env.FORCE_SEND);

  // Ensure Telegram is in polling mode (no webhook), otherwise getUpdates stays empty.
  try {
    await axios.get(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      params: { drop_pending_updates: false },
      timeout: 20000,
    });
  } catch (err) {
    console.error('[GA] deleteWebhook failed (continuing):', err?.message ?? err);
  }

  const issue = await getOrCreateStateIssue({ owner, repo, githubToken });
  const issueNumber = issue.number;
  const currentState = extractStateFromIssueBody(issue.body);

  console.log('[GA] Loaded state:', currentState);

  // 1) Collect new subscribers from updates (from lastUpdateId).
  const offset = (currentState.lastUpdateId ?? 0) + 1;
  const updates = await getTelegramUpdates(botToken, offset, 0);

  let maxUpdateId = currentState.lastUpdateId ?? 0;
  const chatIds = new Set(currentState.chatIds ?? []);

  for (const upd of updates) {
    const updateId = upd?.update_id;
    if (Number.isFinite(updateId)) maxUpdateId = Math.max(maxUpdateId, updateId);

    const msg = getMessageLikeFromUpdate(upd);
    const chatId = msg?.chat?.id;
    const chatType = msg?.chat?.type;
    const text = msg?.text;

    if (!isSubscribeChatType(chatType)) continue;
    if (!Number.isFinite(Number(chatId))) continue;

    if (parseStartCommand(text)) {
      chatIds.add(Number(chatId));
    }
  }

  const nextState = {
    chatIds: [...chatIds],
    lastUpdateId: maxUpdateId,
    lastSentDateKey: currentState.lastSentDateKey ?? null,
  };

  // 2) Send daily update only at 16:05 local, once per day (workflow is scheduled at matching UTC times).
  const sendDecision = forceSend
    ? { ok: true, todayKey: todayKeyInTimeZone(timeZone), reason: 'force_send' }
    : shouldSendNow({
        timeZone,
        targetHour: '16',
        targetMinute: '05',
        lastSentDateKey: nextState.lastSentDateKey,
      });

  console.log('[GA] Time check:', sendDecision);

  const extraFromEnv = parseChatIdsFromEnv(process.env.CHAT_IDS);
  const recipientChatIds = mergeRecipientChatIds(nextState.chatIds, process.env.CHAT_IDS);
  if (extraFromEnv.length) {
    console.log(
      `[GA] CHAT_IDS env: ${extraFromEnv.length} id(s); merged recipients: ${recipientChatIds.length} (issue + env).`
    );
  }

  if (sendDecision.ok) {
    if (!recipientChatIds.length) {
      console.log('[GA] No recipients (empty issue chatIds and no CHAT_IDS); skipping send.');
    } else {
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
        `⏰ Time: 16:05`;

      console.log(`[GA] Sending to ${recipientChatIds.length} chats...`);
      const results = await Promise.allSettled(
        recipientChatIds.map((chatId) => sendTelegramMessage({ botToken, chatId, text }))
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        console.error(`[GA] Send failures: ${failed.length}/${results.length}`);
      } else {
        console.log('[GA] All messages sent successfully.');
      }
    }

    nextState.lastSentDateKey = sendDecision.todayKey;
  }

  // 3) Persist state back into the issue (chatIds + lastUpdateId + lastSentDateKey).
  const newBody = buildIssueBody(nextState);
  await updateIssueBody({ owner, repo, issueNumber, githubToken, body: newBody });

  console.log('[GA] State saved to issue #' + issueNumber);
}

main().catch((err) => {
  console.error('[GA] Failed:', err?.message ?? err);
  process.exitCode = 1;
});

