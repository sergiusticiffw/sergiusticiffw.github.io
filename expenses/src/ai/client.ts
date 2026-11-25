import { streamGemini, testGeminiApiKey } from './providers/gemini';
import {
  streamOpenRouter,
  testOpenRouterApiKey,
} from './providers/openrouter';
import {
  AiFallbackReason,
  AiProviderId,
  fallbackReasonFromError,
  getProviderSettings,
  providerLabel,
} from './providerSettings';
import { recordAiUsageEvent } from './sessionStats';
import { getStoredOpenrouterApiKey } from './storage';
import {
  AiError,
  AiProviderKeys,
  GeminiResult,
  StreamOptions,
} from './types';

export type {
  GeminiPart,
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiRequest,
  GeminiUsage,
  GeminiResult,
  AiErrorKind,
  StreamDebugEvent,
  StreamOptions,
  AiProviderKeys,
} from './types';
export { AiError } from './types';

const isAbort = (error: unknown) =>
  (error as Error)?.name === 'AbortError' ||
  (typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError');

const isTimeout = (error: unknown) =>
  (error as Error)?.name === 'TimeoutError' ||
  (typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'TimeoutError');

/**
 * Run `fn` with a soft timeout. User abort on `outer` is rethrown as AbortError.
 * Soft timeout aborts only the inner signal so the cascade can continue.
 */
const withProviderTimeout = async <T>(
  outer: AbortSignal | undefined,
  timeoutMs: number | null,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) {
    if (outer?.aborted) throw outer.reason ?? new DOMException('Aborted', 'AbortError');
    return fn(outer ?? new AbortController().signal);
  }

  const inner = new AbortController();
  const onOuterAbort = () => {
    inner.abort(outer?.reason ?? new DOMException('Aborted', 'AbortError'));
  };
  if (outer?.aborted) onOuterAbort();
  else outer?.addEventListener('abort', onOuterAbort, { once: true });

  const timer = setTimeout(() => {
    inner.abort(new DOMException('Provider timeout', 'TimeoutError'));
  }, timeoutMs);

  try {
    return await fn(inner.signal);
  } catch (error) {
    if (outer?.aborted) throw error;
    if (isTimeout(error) || (isAbort(error) && !outer?.aborted)) {
      throw new AiError('unknown', `Provider timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
};

const resolveKeys = (options: StreamOptions): Required<AiProviderKeys> => {
  const bag = options.keys || {};
  return {
    gemini: (bag.gemini ?? options.apiKey ?? '').trim(),
    openrouter: (
      bag.openrouter ??
      options.openrouterApiKey ??
      getStoredOpenrouterApiKey()
    ).trim(),
  };
};

const hasAnyProviderKey = (keys: Required<AiProviderKeys>) =>
  Boolean(keys.gemini || keys.openrouter);

const keyFor = (
  id: AiProviderId,
  keys: Required<AiProviderKeys>
): string => {
  switch (id) {
    case 'gemini':
      return keys.gemini;
    case 'openrouter':
      return keys.openrouter;
  }
};

const shouldFallback = (
  reason: AiFallbackReason,
  settings: ReturnType<typeof getProviderSettings>
): boolean => {
  if (!settings.fallbackEnabled) return false;
  if (reason === 'rate_limit' && !settings.fallbackOnRateLimit) return false;
  if (reason === 'quota' && !settings.fallbackOnQuota) return false;
  return true;
};

/**
 * Streams one model step.
 * Walks enabled providers in user order; soft-timeout moves to the next.
 * Does not fall back after a user abort (Stop).
 */
export async function streamGenerate({
  apiKey,
  openrouterApiKey,
  keys: keysOpt,
  tier,
  request,
  signal,
  onText,
  preferModel,
  preferProvider,
  onDebug,
}: StreamOptions): Promise<GeminiResult> {
  if (!navigator.onLine) {
    throw new AiError('offline', 'No internet connection');
  }

  const keys = resolveKeys({ apiKey, openrouterApiKey, keys: keysOpt, tier, request });
  const settings = getProviderSettings();
  const errors: AiError[] = [];
  const tried: AiProviderId[] = [];
  let startedProvider = false;
  let previousProvider: AiProviderId | null = null;
  let previousReason: AiFallbackReason | null = null;

  let candidates = settings.order.filter((id) => {
    const entry = settings.providers[id];
    return entry?.enabled && Boolean(keyFor(id, keys));
  });
  if (preferProvider && candidates.includes(preferProvider)) {
    candidates = [
      preferProvider,
      ...candidates.filter((id) => id !== preferProvider),
    ];
  }

  if (!candidates.length) {
    throw new AiError(
      'invalid_key',
      hasAnyProviderKey(keys)
        ? 'No enabled AI provider with a key. Check Profile → AI assistant.'
        : 'No AI provider configured. Add a Gemini or OpenRouter key.'
    );
  }

  const tryProvider = async (
    id: AiProviderId,
    timeoutMs: number | null,
    run: (signal: AbortSignal) => Promise<GeminiResult>
  ): Promise<GeminiResult | null> => {
    try {
      if (startedProvider) onText?.('');
      startedProvider = true;
      tried.push(id);
      const started = Date.now();
      const result = await withProviderTimeout(signal, timeoutMs, run);
      recordAiUsageEvent({
        provider: id,
        model: result.model,
        ok: true,
        latencyMs: Date.now() - started,
        tokens: result.usage.totalTokenCount || 0,
        fallback: previousProvider != null,
        fallbackReason: previousReason || undefined,
      });
      return result;
    } catch (error) {
      if (signal?.aborted || isAbort(error)) throw error;

      const ai =
        error instanceof AiError
          ? error
          : new AiError(
              'unknown',
              error instanceof Error ? error.message : `${providerLabel(id)} failed`
            );
      errors.push(ai);
      recordAiUsageEvent({
        provider: id,
        model: ai.model || id,
        ok: false,
        latencyMs: 0,
        tokens: 0,
        errorKind: ai.kind,
        fallback: previousProvider != null,
        fallbackReason: previousReason || undefined,
      });
      onDebug?.({
        type: 'http_error',
        model: ai.model || id,
        status: 0,
        durationMs: 0,
        error: ai,
      });
      return null;
    }
  };

  for (let i = 0; i < candidates.length; i++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const id = candidates[i];
    const entry = settings.providers[id];
    const isLast = i === candidates.length - 1;
    // Explicit Gemini model retry: do not soft-timeout Gemini — user asked for it.
    const timeoutMs =
      isLast || (preferModel?.startsWith('gemini-') && id === 'gemini')
        ? null
        : entry.timeoutMs;
    const modelPref =
      preferModel && id === 'gemini'
        ? preferModel
        : entry.model === 'auto'
          ? 'auto'
          : entry.model;

    if (previousProvider && previousReason) {
      if (!shouldFallback(previousReason, settings)) {
        break;
      }
    }

    const result = await tryProvider(id, timeoutMs, (sig) => {
      const common = {
        tier,
        request,
        signal: sig,
        onText,
        onDebug,
        preferModel: modelPref === 'auto' ? undefined : modelPref,
      };
      switch (id) {
        case 'gemini':
          return streamGemini({
            apiKey: keys.gemini,
            ...common,
            preferModel:
              preferModel ||
              (modelPref === 'auto' ? undefined : modelPref),
          });
        case 'openrouter':
          return streamOpenRouter({
            apiKey: keys.openrouter,
            ...common,
            preferModel: modelPref,
          });
      }
    });

    if (result) return result;

    const lastError = errors[errors.length - 1];
    previousProvider = id;
    previousReason = fallbackReasonFromError(lastError);
    if (!settings.fallbackEnabled && !isLast) break;
  }

  const last = errors[errors.length - 1];
  const summary = errors
    .map((err, i) => {
      const id = tried[i] || 'provider';
      const why =
        err.kind === 'quota'
          ? /rate.?limit|too many requests|rpm/i.test(err.message)
            ? 'rate limit'
            : err.daily
              ? 'daily quota'
              : 'quota'
          : err.kind === 'model'
            ? 'model unavailable'
            : err.message || err.kind;
      return `${providerLabel(id as AiProviderId)}: ${why}`;
    })
    .join(' → ');

  throw new AiError(
    last?.kind || 'unknown',
    summary
      ? `All AI providers failed (${summary}).`
      : 'All AI providers failed',
    last?.retryAfterSeconds,
    last?.daily,
    last?.quota,
    last?.model
  );
}

export type AiKeyProvider = 'gemini' | 'openrouter';

/** Test a provider API key. */
export async function testApiKey(
  apiKey: string,
  provider: AiKeyProvider = 'gemini'
): Promise<string> {
  if (provider === 'openrouter') return testOpenRouterApiKey(apiKey);
  return testGeminiApiKey(apiKey);
}

const formatWait = (seconds: number) => {
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds}s`;
};

const isRateLimitMessage = (message: string) =>
  /rate.?limit|too many requests|rpm|requests per/i.test(message);

export const describeAiError = (error: unknown): string => {
  if (error instanceof AiError) {
    switch (error.kind) {
      case 'invalid_key':
        return 'Your API key was rejected. Check it in Profile → AI assistant.';
      case 'quota': {
        const wait = error.retryAfterSeconds
          ? ` Try again in ${formatWait(error.retryAfterSeconds)}.`
          : ' Try again a bit later.';
        if (/All AI providers failed/i.test(error.message)) {
          return `${error.message}${wait}`;
        }
        if (error.daily) return `Daily quota reached.${wait}`;
        if (isRateLimitMessage(error.message)) {
          return `Rate limit reached.${wait}`;
        }
        return `Provider limit reached.${wait}`;
      }
      case 'offline':
        return 'You are offline. The assistant needs an internet connection.';
      case 'blocked':
        return 'The model declined to answer this request.';
      case 'model':
        return error.message && !/^HTTP \d+/.test(error.message)
          ? `Model unavailable: ${error.message}`
          : 'The AI model is not available for this key. Pick another model or refresh the list.';
      default:
        if (/All AI providers failed/i.test(error.message)) {
          return error.message;
        }
        return error.message
          ? `AI request failed: ${error.message}`
          : 'AI request failed. Try again.';
    }
  }
  if ((error as Error)?.name === 'AbortError') return 'Stopped.';
  const message = error instanceof Error ? error.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach the AI provider (network or CORS). Check the key and try again.';
  }
  return message
    ? `AI request failed: ${message}`
    : 'AI request failed. Try again.';
};

/** True when any configured provider key is available. */
export const hasAiAccess = (
  geminiKey?: string,
  openrouterKey?: string
): boolean =>
  Boolean((geminiKey || '').trim()) ||
  Boolean((openrouterKey || getStoredOpenrouterApiKey()).trim());
