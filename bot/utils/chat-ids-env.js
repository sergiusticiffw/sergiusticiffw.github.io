'use strict';

/** Unicode minus (U+2212) → ASCII `-` so `Number(...)` parses Telegram-style negative ids. */
function normalizeIdText(s) {
  return String(s).trim().replace(/\u2212/g, '-');
}

/**
 * Parse comma / space / semicolon separated chat ids (incl. negative group/channel ids like -100…).
 */
function parseChatIdsFromEnv(raw) {
  if (raw == null) return [];
  const s = normalizeIdText(raw);
  if (!s) return [];
  return [
    ...new Set(
      s
        .split(/[,;\s]+/)
        .map((part) => normalizeIdText(part))
        .filter((part) => part.length > 0)
        .map((part) => Number(part))
        .filter(Number.isFinite)
    ),
  ];
}

/** Coerce stored / env id for Telegram (negative supergroups/channels stay negative). */
function normalizeChatId(chatId) {
  if (chatId == null) return null;
  const n = Number(normalizeIdText(chatId));
  return Number.isFinite(n) ? n : null;
}

/** Union of ids from storage (issue / JSON) and CHAT_IDS env (not persisted from env). */
function mergeRecipientChatIds(storedIds, envRaw) {
  const fromEnv = parseChatIdsFromEnv(envRaw);
  return [...new Set([...(storedIds ?? []), ...fromEnv])];
}

module.exports = { parseChatIdsFromEnv, mergeRecipientChatIds, normalizeChatId };
