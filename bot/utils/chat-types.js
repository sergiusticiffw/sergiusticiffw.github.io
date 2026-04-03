'use strict';

/** Chats where /start can subscribe the chat for daily broadcasts (incl. channels as channel_post). */
const SUBSCRIBE_CHAT_TYPES = new Set(['private', 'group', 'supergroup', 'channel']);

function isSubscribeChatType(chatType) {
  return typeof chatType === 'string' && SUBSCRIBE_CHAT_TYPES.has(chatType);
}

module.exports = { SUBSCRIBE_CHAT_TYPES, isSubscribeChatType };
