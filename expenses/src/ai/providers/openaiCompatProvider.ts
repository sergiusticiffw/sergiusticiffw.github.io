/**
 * Shared streaming / test helpers for OpenAI-compatible chat providers
 * (OpenRouter).
 */
import { AI_DEFAULT_COOLDOWN_SECONDS } from '../config';
import { recordAiRequest, recordSessionLimit } from '../sessionStats';
import { getModelCooldowns, saveModelLimit, setModelCooldown } from '../storage';
import {
  AiError,
  GeminiRequest,
  GeminiResult,
  StreamDebugEvent,
} from '../types';
import {
  buildOpenAiBody,
  consumeOpenAiStream,
  openAiHttpError,
} from './openaiCompat';

const cooldownUntil = (error: AiError) =>
  Date.now() + (error.retryAfterSeconds ?? AI_DEFAULT_COOLDOWN_SECONDS) * 1000;

export type OpenAiCompatHeaders = Record<string, string>;

export interface OpenAiCompatStreamOptions {
  apiKey: string;
  baseUrl: string;
  /** Candidate models in preference order. */
  models: string[];
  /** Prefer this model when present in the list (or use it alone if custom). */
  preferModel?: string | 'auto';
  label: string;
  request: GeminiRequest;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
  onDebug?: (event: StreamDebugEvent) => void;
  extraHeaders?: (apiKey: string) => OpenAiCompatHeaders;
}

const authHeaders = (
  apiKey: string,
  extra?: (apiKey: string) => OpenAiCompatHeaders
): OpenAiCompatHeaders => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
  ...(extra ? extra(apiKey) : {}),
});

const resolveModels = (
  models: string[],
  preferModel?: string | 'auto'
): string[] => {
  if (!preferModel || preferModel === 'auto') return models;
  if (models.includes(preferModel)) {
    const start = models.indexOf(preferModel);
    return models.slice(start);
  }
  return [preferModel, ...models];
};

export async function streamOpenAiCompat({
  apiKey,
  baseUrl,
  models: modelList,
  preferModel,
  label,
  request,
  signal,
  onText,
  onDebug,
  extraHeaders,
}: OpenAiCompatStreamOptions): Promise<GeminiResult> {
  const models = resolveModels(modelList, preferModel);
  const cooldowns = getModelCooldowns();
  if (!models.length) {
    throw new AiError('model', `${label}: no model configured`);
  }

  const errors: AiError[] = [];
  for (const model of models) {
    if (cooldowns[model]) {
      onDebug?.({
        type: 'skipped',
        model,
        reason: 'cooldown',
        until: cooldowns[model],
      });
      continue;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const body = buildOpenAiBody(request, model, { stream: true });

    onDebug?.({ type: 'attempt', model, url, request });
    const started = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(apiKey, extraHeaders),
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      throw new AiError(
        'unknown',
        error instanceof Error ? error.message : `${label} network error`
      );
    }

    if (!response.ok) {
      const error = await openAiHttpError(response);
      onDebug?.({
        type: 'http_error',
        model,
        status: response.status,
        durationMs: Date.now() - started,
        error,
      });
      if (error.kind === 'quota') {
        const until = cooldownUntil(error);
        const at = Date.now();
        setModelCooldown(model, until);
        saveModelLimit(model, {
          at,
          until,
          daily: error.daily,
          retryAfterSeconds: error.retryAfterSeconds,
          ...error.quota,
        });
        recordSessionLimit(model, {
          model,
          at,
          until,
          daily: error.daily,
          limit: error.quota?.limit,
        });
      }
      error.model = model;
      errors.push(error);
      // Retired / missing model → try the next candidate.
      if (error.kind === 'model') continue;
      throw error;
    }

    const { result, chunkCount } = await consumeOpenAiStream(
      response,
      model,
      onText,
      signal
    );
    onDebug?.({
      type: 'success',
      model,
      durationMs: Date.now() - started,
      chunkCount,
      result,
    });
    recordAiRequest(model, result.usage.totalTokenCount || 0);
    return result;
  }

  const last = errors[errors.length - 1];
  if (last) throw last;
  const cooled = models.find((m) => cooldowns[m]);
  if (cooled) {
    throw new AiError(
      'quota',
      `${label} is rate limited`,
      Math.max(1, Math.ceil((cooldowns[cooled] - Date.now()) / 1000)),
      true
    );
  }
  throw new AiError('model', `${label}: no available model`);
}

export async function testOpenAiCompatKey(
  apiKey: string,
  baseUrl: string,
  model: string,
  extraHeaders?: (apiKey: string) => OpenAiCompatHeaders,
  /** Preferred candidates when `model` is gone from the catalog. */
  fallbackModels: string[] = []
): Promise<string> {
  let candidates = [model, ...fallbackModels.filter((m) => m !== model)];
  try {
    const live = await listOpenAiCompatModels(apiKey, baseUrl, extraHeaders);
    if (live.length) {
      const preferred = candidates.filter((m) => live.includes(m));
      candidates = preferred.length
        ? preferred
        : [live[0], ...candidates.filter((m) => m !== live[0])];
    }
  } catch {
    // Catalog unavailable — still try the curated ping list.
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: authHeaders(apiKey, extraHeaders),
          body: JSON.stringify({
            model: candidate,
            stream: false,
            max_tokens: 8,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        }
      );
      if (!response.ok) {
        lastError = await openAiHttpError(response);
        // Try next model when this one is retired / missing.
        if (
          lastError instanceof AiError &&
          (lastError.kind === 'model' || response.status === 410)
        ) {
          continue;
        }
        throw lastError;
      }
      return candidate;
    } catch (error) {
      lastError = error;
      if (error instanceof AiError && error.kind === 'model') continue;
      throw error;
    }
  }
  throw (
    lastError ||
    new AiError('model', 'No available model found for this API key')
  );
}

/** List model ids from an OpenAI-compatible `/models` endpoint. */
export async function listOpenAiCompatModels(
  apiKey: string,
  baseUrl: string,
  extraHeaders?: (apiKey: string) => OpenAiCompatHeaders
): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
    method: 'GET',
    headers: authHeaders(apiKey, extraHeaders),
  });
  if (!response.ok) throw await openAiHttpError(response);
  const body = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  const ids = (body.data || [])
    .map((row) => (typeof row.id === 'string' ? row.id : ''))
    .filter(Boolean);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
