'use strict';

/** Parse comma / space / semicolon separated numeric chat ids from env (e.g. GitHub secret CHAT_IDS). */
function parseChatIdsFromEnv(raw) {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  return [
    ...new Set(
      s
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite)
    ),
  ];
}

/** Union of ids from storage (issue / JSON) and CHAT_IDS env (not persisted from env). */
function mergeRecipientChatIds(storedIds, envRaw) {
  const fromEnv = parseChatIdsFromEnv(envRaw);
  return [...new Set([...(storedIds ?? []), ...fromEnv])];
}

module.exports = { parseChatIdsFromEnv, mergeRecipientChatIds };
