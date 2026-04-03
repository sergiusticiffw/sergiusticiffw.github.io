'use strict';

const axios = require('axios');

async function sendTelegramMessage({ botToken, chatId, text }) {
  // Sends a plain text Telegram message using the Bot API.
  if (!botToken) throw new Error('Missing BOT_TOKEN');
  if (chatId == null || chatId === '') throw new Error('Missing CHAT_ID');
  if (!text) throw new Error('Missing message text');

  const { normalizeChatId } = require('../utils/chat-ids-env');
  const resolvedId = normalizeChatId(chatId);
  if (resolvedId == null) {
    throw new Error(`Invalid CHAT_ID (not a finite number): ${JSON.stringify(chatId)}`);
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await axios.post(
    url,
    {
      chat_id: resolvedId,
      text,
      disable_web_page_preview: true,
    },
    { validateStatus: () => true }
  );

  const data = res?.data;
  if (data?.ok === true) return;

  const code = data?.error_code ?? res.status;
  const desc = data?.description ?? res.statusText ?? 'Unknown Telegram error';
  throw new Error(`Telegram sendMessage failed for chat_id=${resolvedId}: [${code}] ${desc}`);
}

async function getTelegramUpdates({ botToken, offset = 0, timeoutSeconds = 30 } = {}) {
  // Polls Telegram updates (long polling). We use `offset` to avoid repeats.
  if (!botToken) throw new Error('Missing BOT_TOKEN');

  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const { data } = await axios.get(url, {
    params: { timeout: timeoutSeconds, offset },
    timeout: timeoutSeconds * 1000 + 5000,
  });

  if (!data?.ok) {
    throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);
  }

  return data?.result ?? [];
}

/** Message-like payload from a getUpdates entry (DM, group, or channel post). */
function getMessageLikeFromUpdate(update) {
  if (!update || typeof update !== 'object') return null;
  return (
    update.message ??
    update.edited_message ??
    update.channel_post ??
    update.edited_channel_post ??
    null
  );
}

module.exports = { sendTelegramMessage, getTelegramUpdates, getMessageLikeFromUpdate };

