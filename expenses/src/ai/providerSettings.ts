import {
  AI_LIMITS,
  AI_REMOVED_STORAGE_KEYS,
  AI_STORAGE_KEYS,
} from './config';

export const AI_PROVIDER_IDS = ['gemini', 'openrouter'] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiProviderEntry = {
  id: AiProviderId;
  enabled: boolean;
  /** Soft failover timeout; null = no soft timeout (typical for last provider). */
  timeoutMs: number | null;
  /** Fixed model id, or `auto` to walk the provider's default list. */
  model: string | 'auto';
};

export type AiProviderSettings = {
  order: AiProviderId[];
  providers: Record<AiProviderId, AiProviderEntry>;
  fallbackEnabled: boolean;
  fallbackOnRateLimit: boolean;
  fallbackOnQuota: boolean;
};

export type AiFallbackReason =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'http_error'
  | 'invalid_key'
  | 'unavailable_model'
  | 'blocked'
  | 'unknown'
  | 'disabled'
  | 'missing_key';

const DEFAULT_TIMEOUT = AI_LIMITS.providerFailoverMs;

const defaultEntry = (
  id: AiProviderId,
  timeoutMs: number | null
): AiProviderEntry => ({
  id,
  enabled: true,
  timeoutMs,
  model: 'auto',
});

export const DEFAULT_PROVIDER_ORDER: AiProviderId[] = ['gemini', 'openrouter'];

export const defaultProviderSettings = (): AiProviderSettings => ({
  order: [...DEFAULT_PROVIDER_ORDER],
  providers: {
    gemini: defaultEntry('gemini', DEFAULT_TIMEOUT),
    openrouter: defaultEntry('openrouter', null),
  },
  fallbackEnabled: true,
  fallbackOnRateLimit: true,
  fallbackOnQuota: true,
});

const isProviderId = (value: unknown): value is AiProviderId =>
  typeof value === 'string' &&
  (AI_PROVIDER_IDS as readonly string[]).includes(value);

const cleanEntry = (
  id: AiProviderId,
  raw: unknown,
  fallbackTimeout: number | null
): AiProviderEntry => {
  const base = defaultEntry(id, fallbackTimeout);
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  // Timeout + model are fixed defaults (no UI); only enabled is user-editable.
  return {
    ...base,
    enabled: row.enabled !== false,
  };
};

export const cleanProviderSettings = (raw: unknown): AiProviderSettings => {
  const defaults = defaultProviderSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const data = raw as Record<string, unknown>;

  const orderRaw = Array.isArray(data.order) ? data.order : [];
  const hadUnknown = orderRaw.some(
    (id) => typeof id === 'string' && !isProviderId(id)
  );
  let order: AiProviderId[] = [];
  for (const id of orderRaw) {
    if (isProviderId(id) && !order.includes(id)) order.push(id);
  }
  // Dropped providers (Mistral, SambaNova, …) → reset to the current default order.
  if (!order.length || hadUnknown) {
    order = [...DEFAULT_PROVIDER_ORDER];
  }
  for (const id of DEFAULT_PROVIDER_ORDER) {
    if (!order.includes(id)) order.push(id);
  }

  const providersRaw =
    data.providers && typeof data.providers === 'object'
      ? (data.providers as Record<string, unknown>)
      : {};

  const providers = {} as Record<AiProviderId, AiProviderEntry>;
  for (const id of AI_PROVIDER_IDS) {
    const isLast = order[order.length - 1] === id;
    providers[id] = cleanEntry(
      id,
      providersRaw[id],
      isLast ? null : DEFAULT_TIMEOUT
    );
  }

  // Fallback flags are fixed on (no UI).
  return {
    order,
    providers,
    fallbackEnabled: true,
    fallbackOnRateLimit: true,
    fallbackOnQuota: true,
  };
};

/** One-time wipe of removed-provider keys left in localStorage. */
const purgeRemovedProviderKeys = () => {
  for (const key of AI_REMOVED_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
};

export const getProviderSettings = (): AiProviderSettings => {
  try {
    purgeRemovedProviderKeys();
    const raw = JSON.parse(
      localStorage.getItem(AI_STORAGE_KEYS.providers) || 'null'
    );
    const cleaned = cleanProviderSettings(raw);
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { order?: unknown }).order) &&
      ((raw as { order: unknown[] }).order || []).some(
        (id) => typeof id === 'string' && !isProviderId(id)
      )
    ) {
      localStorage.setItem(AI_STORAGE_KEYS.providers, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return defaultProviderSettings();
  }
};

export const setProviderSettings = (settings: AiProviderSettings) => {
  const next = cleanProviderSettings(settings);
  localStorage.setItem(AI_STORAGE_KEYS.providers, JSON.stringify(next));
  void import('../features/profile/preferencesSync')
    .then((m) => m.schedulePreferencesPush({ aiProviders: next }))
    .catch(() => undefined);
  return next;
};

export const updateProviderEntry = (
  id: AiProviderId,
  patch: Partial<Omit<AiProviderEntry, 'id'>>
): AiProviderSettings => {
  const current = getProviderSettings();
  const entry = { ...current.providers[id], ...patch, id };
  return setProviderSettings({
    ...current,
    providers: { ...current.providers, [id]: entry },
  });
};

export const setProviderOrder = (order: AiProviderId[]): AiProviderSettings => {
  const current = getProviderSettings();
  return setProviderSettings({ ...current, order });
};

export const providerLabel = (id: AiProviderId): string => {
  switch (id) {
    case 'gemini':
      return 'Gemini';
    case 'openrouter':
      return 'OpenRouter';
  }
};

export const fallbackReasonFromError = (
  error: { kind?: string; message?: string } | null
): AiFallbackReason => {
  if (!error) return 'unknown';
  if (error.kind === 'quota') {
    return /rate|429|per.?minute|rpm/i.test(error.message || '')
      ? 'rate_limit'
      : 'quota';
  }
  if (error.kind === 'invalid_key') return 'invalid_key';
  if (error.kind === 'model') return 'unavailable_model';
  if (error.kind === 'blocked') return 'blocked';
  if (/timed? ?out/i.test(error.message || '')) return 'timeout';
  if (error.kind === 'unknown' || error.kind === 'offline') return 'http_error';
  return 'unknown';
};
