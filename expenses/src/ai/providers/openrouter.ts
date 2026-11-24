import {
  AI_DEFAULT_COOLDOWN_SECONDS,
  AI_MODELS,
  AiModelTier,
  OPENROUTER_API_URL,
} from '../config';
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

export interface OpenRouterStreamOptions {
  apiKey: string;
  tier: AiModelTier;
  request: GeminiRequest;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
  onDebug?: (event: StreamDebugEvent) => void;
}

export async function streamOpenRouter({
  apiKey,
  tier,
  request,
  signal,
  onText,
  onDebug,
}: OpenRouterStreamOptions): Promise<GeminiResult> {
  const models =
    tier === 'lite'
      ? [...AI_MODELS.openrouterLite]
      : [...AI_MODELS.openrouterChat];
  const cooldowns = getModelCooldowns();
  const model = models.find((m) => !cooldowns[m]) || models[0];

  if (cooldowns[model]) {
    onDebug?.({
      type: 'skipped',
      model,
      reason: 'cooldown',
      until: cooldowns[model],
    });
    throw new AiError(
      'quota',
      'OpenRouter Free is rate limited',
      Math.max(1, Math.ceil((cooldowns[model] - Date.now()) / 1000)),
      true
    );
  }

  const url = `${OPENROUTER_API_URL}/chat/completions`;
  const body = buildOpenAiBody(request, model, { stream: true });

  onDebug?.({ type: 'attempt', model, url, request });
  const started = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer':
        typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'Expenses Assistant',
    },
    body: JSON.stringify(body),
    signal,
  });

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

/** Validates an OpenRouter key with a tiny free-router completion. */
export async function testOpenRouterApiKey(apiKey: string): Promise<string> {
  const model = AI_MODELS.openrouterChat[0];
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer':
        typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'Expenses Assistant',
    },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!response.ok) throw await openAiHttpError(response);
  return model;
}
