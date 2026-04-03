'use strict';

/** Chats where /start can subscribe the chat for daily broadcasts (negative id = groups). */
const SUBSCRIBE_CHAT_TYPES = new Set(['private', 'group', 'supergroup']);

function isSubscribeChatType(chatType) {
  return typeof chatType === 'string' && SUBSCRIBE_CHAT_TYPES.has(chatType);
}

module.exports = { SUBSCRIBE_CHAT_TYPES, isSubscribeChatType };
