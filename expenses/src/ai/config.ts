export const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

/** Drupal user field that stores the user's own Gemini API key. */
export const AI_KEY_FIELD = 'field_gemini_api_key';

/**
 * Model candidates per tier / provider. Gemini free tier has a separate quota
 * per model, so when one hits its limit (429) or is retired (404) the next one
 * is used. OpenRouter Free uses a single router model.
 * gemini-3.5-flash is deprecated; Google routes those requests to gemini-3.6-flash.
 */
export const AI_MODELS = {
  chat: [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ],
  lite: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'],
  openrouterChat: ['openrouter/free'],
  openrouterLite: ['openrouter/free'],
} as const;

/** Cooldown when a 429 has no retryDelay. */
export const AI_DEFAULT_COOLDOWN_SECONDS = 60;

export type AiModelTier = 'chat' | 'lite';

/** Short model label shown under answers, e.g. "3.8-flash" or "free". */
export const modelLabel = (model?: string): string | null => {
  if (!model) return null;
  if (model === 'openrouter/free' || model.startsWith('openrouter/')) {
    return model.replace(/^openrouter\//, '');
  }
  return model.replace(/^gemini-/, '');
};

/** Next model in a Gemini tier after `after`, or the second model if none is given. */
export const nextModel = (
  tier: AiModelTier,
  after?: string
): string | null => {
  const list = AI_MODELS[tier] as readonly string[];
  const index = after ? list.indexOf(after) : 0;
  return index >= 0 ? list[index + 1] || null : list[1] || null;
};

/** Next model in the chat list after `after`, or the second model if none is given. */
export const nextChatModel = (after?: string): string | null =>
  nextModel('chat', after);

export const AI_LIMITS = {
  /** Safety cap per step; includes thinking tokens. Actual usage is much lower. */
  chatMaxOutputTokens: 4096,
  /** Tool-call rounds per question before the model is forced to answer. */
  maxToolRounds: 5,
  /** Past user+model turns kept in the request (older ones are dropped). */
  maxHistoryTurns: 8,
  /** After this long without a finished request, the chat offers a smaller model. */
  slowRequestMs: 5000,
  /**
   * Soft timeout for Gemini. On expiry the cascade moves to OpenRouter Free.
   * OpenRouter (last) has no soft timeout.
   */
  providerFailoverMs: 12_000,
  toolRowsDefault: 50,
  toolRowsMax: 300,
  toolGroupsDefault: 60,
  toolGroupsMax: 200,
  summaryTopDescriptions: 30,
};

export const AI_STORAGE_KEYS = {
  apiKey: 'geminiApiKey',
  openrouterApiKey: 'openrouterApiKey',
  shareDescriptions: 'aiShareDescriptions',
  usage: 'aiUsage',
  language: 'aiLanguage',
  insights: 'aiInsights',
  chat: 'aiChat',
  modelCooldowns: 'aiModelCooldowns',
  modelLimits: 'aiModelLimits',
  debug: 'aiDebug',
};

export const AI_LANGUAGES = ['Romanian', 'English'] as const;

export const AI_INSIGHT_LIMITS = {
  maxOutputTokens: 2048,
  /** Cached insights kept on the device (oldest are evicted). */
  cacheEntries: 40,
};
