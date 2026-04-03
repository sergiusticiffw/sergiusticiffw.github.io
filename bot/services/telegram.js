'use strict';

const axios = require('axios');

async function sendTelegramMessage({ botToken, chatId, text }) {
  // Sends a plain text Telegram message using the Bot API.
  if (!botToken) throw new Error('Missing BOT_TOKEN');
  if (!chatId) throw new Error('Missing CHAT_ID');
  if (!text) throw new Error('Missing message text');

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await axios.post(url, {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });

  if (res?.data?.ok !== true) {
    const details = res?.data ?? 'Unknown Telegram error';
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(details)}`);
  }
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

module.exports = { sendTelegramMessage, getTelegramUpdates };

