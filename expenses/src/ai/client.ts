import { AI_LIMITS } from './config';
import { streamGemini, testGeminiApiKey } from './providers/gemini';
import {
  streamOpenRouter,
  testOpenRouterApiKey,
} from './providers/openrouter';
import { getStoredOpenrouterApiKey } from './storage';
import {
  AiError,
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

/**
 * Streams one model step.
 * Cascade: Gemini → OpenRouter Free (last / best effort).
 * Soft-timeout on Gemini moves to OpenRouter.
 * Does not fall back after a user abort (Stop).
 */
export async function streamGenerate({
  apiKey,
  openrouterApiKey,
  tier,
  request,
  signal,
  onText,
  preferModel,
  onDebug,
}: StreamOptions): Promise<GeminiResult> {
  if (!navigator.onLine) {
    throw new AiError('offline', 'No internet connection');
  }

  const orKey = (openrouterApiKey ?? getStoredOpenrouterApiKey()).trim();
  const geminiKey = (apiKey || '').trim();
  const errors: AiError[] = [];
  const failoverMs = AI_LIMITS.providerFailoverMs;
  let startedProvider = false;

  const tryProvider = async (
    label: string,
    timeoutMs: number | null,
    run: (signal: AbortSignal) => Promise<GeminiResult>
  ): Promise<GeminiResult | null> => {
    try {
      // Only clear partial stream when switching providers — not on the first
      // attempt, or "Thinking" disappears (onText clears activity).
      if (startedProvider) onText?.('');
      startedProvider = true;
      return await withProviderTimeout(signal, timeoutMs, run);
    } catch (error) {
      // User hit Stop — do not cascade.
      if (signal?.aborted || isAbort(error)) throw error;

      const ai =
        error instanceof AiError
          ? error
          : new AiError(
              'unknown',
              error instanceof Error ? error.message : `${label} failed`
            );
      errors.push(ai);
      onDebug?.({
        type: 'http_error',
        model: ai.model || label,
        status: 0,
        durationMs: 0,
        error: ai,
      });
      return null;
    }
  };

  // 1) Gemini (primary) — fail or slow → OpenRouter
  if (geminiKey) {
    const result = await tryProvider('gemini', failoverMs, (sig) =>
      streamGemini({
        apiKey: geminiKey,
        tier,
        request,
        signal: sig,
        onText,
        preferModel,
        onDebug,
      })
    );
    if (result) return result;
  }

  // 2) OpenRouter Free — last / best effort (no soft timeout)
  if (orKey) {
    const result = await tryProvider('openrouter', null, (sig) =>
      streamOpenRouter({
        apiKey: orKey,
        tier,
        request,
        signal: sig,
        onText,
        onDebug,
      })
    );
    if (result) return result;
  }

  if (!geminiKey && !orKey) {
    throw new AiError(
      'invalid_key',
      'No AI provider configured. Add a Gemini or OpenRouter key.'
    );
  }

  throw (
    errors[errors.length - 1] ||
    new AiError('unknown', 'All AI providers failed')
  );
}

/** Test a Gemini or OpenRouter key. */
export async function testApiKey(
  apiKey: string,
  provider: 'gemini' | 'openrouter' = 'gemini'
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

export const describeAiError = (error: unknown): string => {
  if (error instanceof AiError) {
    switch (error.kind) {
      case 'invalid_key':
        return 'Your API key was rejected. Check it in Profile → AI assistant.';
      case 'quota':
        return error.retryAfterSeconds
          ? `Free tier limit reached. Try again in ${formatWait(error.retryAfterSeconds)}.`
          : 'Free tier limit reached. Try again a bit later.';
      case 'offline':
        return 'You are offline. The assistant needs an internet connection.';
      case 'blocked':
        return 'The model declined to answer this request.';
      case 'model':
        return 'The AI model is not available for this key.';
      default:
        return `AI request failed: ${error.message}`;
    }
  }
  if ((error as Error)?.name === 'AbortError') return 'Stopped.';
  return 'AI request failed. Try again.';
};

/** True when Gemini and/or OpenRouter key is available. */
export const hasAiAccess = (
  geminiKey?: string,
  openrouterKey?: string
): boolean =>
  Boolean((geminiKey || '').trim()) ||
  Boolean((openrouterKey || getStoredOpenrouterApiKey()).trim());
