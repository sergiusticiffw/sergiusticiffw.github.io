import {
  AI_DEFAULT_COOLDOWN_SECONDS,
  AI_MODELS,
  AiModelTier,
  GEMINI_API_URL,
} from '../config';
import { recordAiRequest, recordSessionLimit } from '../sessionStats';
import { getModelCooldowns, saveModelLimit, setModelCooldown } from '../storage';
import {
  AiError,
  GeminiContent,
  GeminiPart,
  GeminiRequest,
  GeminiResult,
  GeminiUsage,
  StreamDebugEvent,
} from '../types';

/** Parses "29405s", "8h10m5s", or a plain number of seconds. */
const parseDuration = (text: string): number | undefined => {
  const value = text.trim();
  const hms = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return Math.ceil(
      Number(hms[1] || 0) * 3600 +
        Number(hms[2] || 0) * 60 +
        Number(hms[3] || 0)
    );
  }
  const seconds = parseFloat(value);
  return Number.isNaN(seconds) ? undefined : Math.ceil(seconds);
};

const parseRetryDelay = (
  details: any[] | undefined,
  message?: string
): number | undefined => {
  const retry = details?.find(
    (d) => typeof d?.retryDelay === 'string'
  )?.retryDelay;
  if (retry) {
    const seconds = parseDuration(retry);
    if (seconds !== undefined) return seconds;
  }
  const fromMessage = message?.match(/retry in ([0-9.hms]+)/i)?.[1];
  return fromMessage ? parseDuration(fromMessage) : undefined;
};

const quotaText = (v: any) => `${v?.quotaId ?? ''}${v?.quotaMetric ?? ''}`;
const isPerDay = (v: any) => /PerDay/i.test(quotaText(v));

const isDailyQuota = (message: string, details: any[] | undefined) =>
  /per ?day/i.test(message) ||
  !!details?.some((d) => d?.violations?.some(isPerDay));

const cooldownUntil = (error: AiError) =>
  Date.now() + (error.retryAfterSeconds ?? AI_DEFAULT_COOLDOWN_SECONDS) * 1000;

/** Signatures from another model fail validation, so they are replaced with the documented bypass value. */
const SKIP_SIGNATURE = 'skip_thought_signature_validator';

/**
 * Gemini 3 requires thoughtSignature on functionCall parts in the current turn.
 * Cross-provider history (e.g. OpenRouter) and lost stream signatures need the
 * documented bypass; foreign signatures must never be forwarded as-is.
 */
const preparePartsForGemini = (
  parts: GeminiPart[],
  foreignAuthor: boolean
): GeminiPart[] =>
  parts.map((part) => {
    let next = part;
    if (foreignAuthor && part.thoughtSignature) {
      next = { ...next, thoughtSignature: SKIP_SIGNATURE };
    }
    if (part.functionCall && !next.thoughtSignature) {
      next = { ...next, thoughtSignature: SKIP_SIGNATURE };
    }
    return next;
  });

const contentsFor = (contents: GeminiContent[], model: string) =>
  contents.map(({ model: author, shared: _shared, ...content }) => ({
    ...content,
    parts: preparePartsForGemini(
      content.parts,
      Boolean(author && author !== model)
    ),
  }));

/** Normalize REST/SSE field names to our camelCase GeminiPart shape. */
const normalizePart = (raw: Record<string, unknown>): GeminiPart => {
  const thoughtSignature =
    (typeof raw.thoughtSignature === 'string' && raw.thoughtSignature) ||
    (typeof raw.thought_signature === 'string' && raw.thought_signature) ||
    undefined;
  const thought = Boolean(raw.thought);
  const text = typeof raw.text === 'string' ? raw.text : undefined;

  const fcRaw = (raw.functionCall || raw.function_call) as
    | Record<string, unknown>
    | undefined;
  const functionCall = fcRaw
    ? {
        ...(typeof fcRaw.id === 'string' ? { id: fcRaw.id } : {}),
        name: String(fcRaw.name || ''),
        args:
          fcRaw.args && typeof fcRaw.args === 'object'
            ? (fcRaw.args as Record<string, unknown>)
            : {},
      }
    : undefined;

  const frRaw = (raw.functionResponse || raw.function_response) as
    | Record<string, unknown>
    | undefined;
  const functionResponse = frRaw
    ? {
        ...(typeof frRaw.id === 'string' ? { id: frRaw.id } : {}),
        name: String(frRaw.name || ''),
        response:
          frRaw.response && typeof frRaw.response === 'object'
            ? (frRaw.response as Record<string, unknown>)
            : {},
      }
    : undefined;

  const part: GeminiPart = {};
  if (text !== undefined) part.text = text;
  if (thought) part.thought = true;
  if (thoughtSignature) part.thoughtSignature = thoughtSignature;
  if (functionCall?.name) part.functionCall = functionCall;
  if (functionResponse?.name) part.functionResponse = functionResponse;
  return part;
};

const isEmptyPart = (part: GeminiPart) =>
  !part.text &&
  !part.functionCall &&
  !part.functionResponse &&
  !part.thoughtSignature;

/**
 * Aggregate SSE part deltas into the parts we echo back on the next tool round.
 * Preserves thoughtSignature on functionCall parts (Gemini 3 requirement).
 */
const aggregateStreamParts = () => {
  const parts: GeminiPart[] = [];
  let textBuf = '';
  let textIsThought = false;
  let textSignature: string | undefined;
  let pendingFc: GeminiPart | null = null;

  const flushText = () => {
    if (!textBuf && !textSignature) return;
    const part: GeminiPart = {};
    if (textBuf) part.text = textBuf;
    if (textIsThought) part.thought = true;
    if (textSignature) part.thoughtSignature = textSignature;
    parts.push(part);
    textBuf = '';
    textIsThought = false;
    textSignature = undefined;
  };

  const flushFc = () => {
    if (!pendingFc) return;
    parts.push(pendingFc);
    pendingFc = null;
  };

  const push = (raw: Record<string, unknown>) => {
    const part = normalizePart(raw);
    if (isEmptyPart(part)) return;

    if (part.functionCall) {
      flushText();
      const samePending =
        pendingFc?.functionCall &&
        ((part.functionCall.id &&
          pendingFc.functionCall.id === part.functionCall.id) ||
          (!part.functionCall.id &&
            !pendingFc.functionCall.id &&
            pendingFc.functionCall.name === part.functionCall.name));
      if (samePending && pendingFc?.functionCall) {
        pendingFc = {
          ...pendingFc,
          functionCall: {
            ...pendingFc.functionCall,
            ...part.functionCall,
            args: {
              ...(pendingFc.functionCall.args || {}),
              ...(part.functionCall.args || {}),
            },
          },
          thoughtSignature:
            part.thoughtSignature || pendingFc.thoughtSignature,
        };
      } else {
        flushFc();
        pendingFc = part;
      }
      return;
    }

    flushFc();

    if (part.text !== undefined || part.thought || part.thoughtSignature) {
      const isThought = Boolean(part.thought);
      if (textBuf && isThought !== textIsThought) flushText();
      if (!textBuf) textIsThought = isThought;
      if (part.text) textBuf += part.text;
      if (part.thoughtSignature) textSignature = part.thoughtSignature;
      return;
    }

    flushText();
    parts.push(part);
  };

  const finish = () => {
    flushText();
    flushFc();
    return parts;
  };

  return { push, finish };
};

export const geminiHttpError = async (response: Response): Promise<AiError> => {
  let message = `HTTP ${response.status}`;
  let details: any[] | undefined;
  try {
    const body = await response.json();
    message = body?.error?.message || message;
    details = body?.error?.details;
  } catch {
    // non-JSON error body
  }
  if (response.status === 429) {
    const violations: any[] =
      details?.flatMap((d) => d?.violations || []) || [];
    const violation =
      violations.find(isPerDay) ||
      violations.find((v) => v?.quotaId || v?.quotaMetric);
    const limit =
      Number(violation?.quotaValue) ||
      Number(message.match(/limit:\s*(\d+)/i)?.[1]) ||
      undefined;
    return new AiError(
      'quota',
      message,
      parseRetryDelay(details, message),
      isDailyQuota(message, details),
      {
        quotaId: violation?.quotaId || violation?.quotaMetric,
        limit,
      }
    );
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    /api key/i.test(message)
  ) {
    return new AiError('invalid_key', message);
  }
  if (response.status === 404) {
    return new AiError('model', message);
  }
  return new AiError('unknown', message);
};

const headers = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-goog-api-key': apiKey,
});

/** Models that returned 404 for this key during the session. */
const unavailableModels = new Set<string>();

async function* readSse(response: Response, signal?: AbortSignal) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator: number;
      while ((separator = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, separator).trim();
        buffer = buffer.slice(separator + 1);
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload) yield JSON.parse(payload);
        }
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith('data:') && rest.slice(5).trim()) {
      yield JSON.parse(rest.slice(5).trim());
    }
  } finally {
    reader.releaseLock();
  }
}

const allLimitedError = (models: string[]) => {
  const cooldowns = getModelCooldowns();
  const waitMs =
    Math.min(...models.map((m) => cooldowns[m] ?? Date.now())) - Date.now();
  return new AiError(
    'quota',
    'All models are rate limited',
    Math.max(1, Math.ceil(waitMs / 1000))
  );
};

export interface GeminiStreamOptions {
  apiKey: string;
  tier: AiModelTier;
  request: GeminiRequest;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
  preferModel?: string;
  onDebug?: (event: StreamDebugEvent) => void;
}

/**
 * Streams one Gemini model step. Tries models in the tier list with cooldown skip.
 */
export async function streamGemini({
  apiKey,
  tier,
  request,
  signal,
  onText,
  preferModel,
  onDebug,
}: GeminiStreamOptions): Promise<GeminiResult> {
  const list: string[] = [...AI_MODELS[tier]];
  const start = preferModel ? list.indexOf(preferModel) : 0;
  const cooldowns = getModelCooldowns();
  const available: string[] = [];
  const candidates: string[] = [];

  for (const model of list.slice(start >= 0 && preferModel ? start : 0)) {
    if (unavailableModels.has(model)) {
      onDebug?.({ type: 'skipped', model, reason: 'unavailable' });
      continue;
    }
    available.push(model);
    if (cooldowns[model]) {
      onDebug?.({
        type: 'skipped',
        model,
        reason: 'cooldown',
        until: cooldowns[model],
      });
      continue;
    }
    candidates.push(model);
  }

  if (available.length && !candidates.length) throw allLimitedError(available);

  let lastError: AiError | null = null;

  for (const model of candidates) {
    const url = `${GEMINI_API_URL}/models/${model}:streamGenerateContent?alt=sse`;
    const payload: GeminiRequest = {
      ...request,
      contents: contentsFor(request.contents, model),
    };
    onDebug?.({ type: 'attempt', model, url, request: payload });
    const started = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      lastError = await geminiHttpError(response);
      onDebug?.({
        type: 'http_error',
        model,
        status: response.status,
        durationMs: Date.now() - started,
        error: lastError,
      });
      if (lastError.kind === 'model') {
        unavailableModels.add(model);
        continue;
      }
      if (lastError.kind === 'quota') {
        const until = cooldownUntil(lastError);
        const at = Date.now();
        setModelCooldown(model, until);
        saveModelLimit(model, {
          at,
          until,
          daily: lastError.daily,
          retryAfterSeconds: lastError.retryAfterSeconds,
          ...lastError.quota,
        });
        recordSessionLimit(model, {
          model,
          at,
          until,
          daily: lastError.daily,
          limit: lastError.quota?.limit,
        });
        continue;
      }
      lastError.model = model;
      throw lastError;
    }

    const aggregator = aggregateStreamParts();
    let text = '';
    let usage: GeminiUsage = {};
    let finishReason: string | undefined;
    let chunkCount = 0;

    for await (const chunk of readSse(response, signal)) {
      chunkCount += 1;
      const candidate = chunk?.candidates?.[0];
      if (chunk?.promptFeedback?.blockReason) {
        throw new AiError(
          'blocked',
          `Blocked: ${chunk.promptFeedback.blockReason}`
        );
      }
      for (const raw of (candidate?.content?.parts || []) as Record<
        string,
        unknown
      >[]) {
        aggregator.push(raw);
        const part = normalizePart(raw);
        if (part.text && !part.thought) {
          text += part.text;
          onText?.(text);
        }
      }
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      if (chunk?.usageMetadata) usage = chunk.usageMetadata;
    }

    const parts = aggregator.finish();
    const functionCalls = parts
      .filter((p) => p.functionCall)
      .map((p) => p.functionCall!);

    const result = { parts, text, functionCalls, usage, finishReason, model };
    onDebug?.({
      type: 'success',
      model,
      durationMs: Date.now() - started,
      chunkCount,
      result,
    });
    recordAiRequest(model, usage.totalTokenCount || 0);
    return result;
  }

  if (lastError?.kind === 'quota') throw allLimitedError(available);
  throw lastError || new AiError('model', 'No available model');
}

/** Validates the Gemini key and model access without spending generation quota. */
export async function testGeminiApiKey(apiKey: string): Promise<string> {
  let lastError: AiError | null = null;
  for (const model of AI_MODELS.chat) {
    const response = await fetch(`${GEMINI_API_URL}/models/${model}`, {
      headers: headers(apiKey),
    });
    if (response.ok) return model;
    lastError = await geminiHttpError(response);
    if (lastError.kind !== 'model') throw lastError;
  }
  throw lastError || new AiError('model', 'No available model');
}
