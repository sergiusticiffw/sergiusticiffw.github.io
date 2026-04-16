const SUBSCRIBE_CHAT_TYPES = new Set(['private', 'group', 'supergroup', 'channel'])

export function isSubscribeChatType(chatType: unknown): boolean {
  return typeof chatType === 'string' && SUBSCRIBE_CHAT_TYPES.has(chatType)
}

