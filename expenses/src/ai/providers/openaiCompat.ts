/**
 * Shared GeminiRequest ↔ OpenAI chat-completions conversion + SSE parsing.
 * Used by OpenRouter (and any future OpenAI-compatible providers).
 */
import {
  AiError,
  GeminiFunctionDeclaration,
  GeminiPart,
  GeminiRequest,
  GeminiResult,
  GeminiUsage,
} from '../types';

export type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type OpenAiChatBody = {
  model: string;
  messages: OpenAiMessage[];
  tools?: OpenAiTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' } | { type: 'json_schema'; json_schema: unknown };
};

const newToolId = () =>
  `call_${Math.random().toString(36).slice(2, 12)}`;

const textFromParts = (parts: GeminiPart[]) =>
  parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!)
    .join('');

/** Convert Gemini contents + system instruction into OpenAI messages. */
export const toOpenAiMessages = (request: GeminiRequest): OpenAiMessage[] => {
  const messages: OpenAiMessage[] = [];
  const system = request.systemInstruction?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n');
  if (system) messages.push({ role: 'system', content: system });

  for (const content of request.contents) {
    const functionCalls = content.parts.filter((p) => p.functionCall);
    const functionResponses = content.parts.filter((p) => p.functionResponse);
    const text = textFromParts(content.parts);

    if (functionResponses.length) {
      for (const part of functionResponses) {
        const fr = part.functionResponse!;
        messages.push({
          role: 'tool',
          tool_call_id: fr.id || newToolId(),
          name: fr.name,
          content: JSON.stringify(fr.response ?? {}),
        });
      }
      continue;
    }

    if (functionCalls.length) {
      // Prefer empty string over null for OpenAI-compatible providers.
      messages.push({
        role: 'assistant',
        content: text || '',
        tool_calls: functionCalls.map((part) => {
          const fc = part.functionCall!;
          return {
            id: fc.id || newToolId(),
            type: 'function' as const,
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args ?? {}),
            },
          };
        }),
      });
      continue;
    }

    messages.push({
      role: content.role === 'model' ? 'assistant' : 'user',
      content: text || '',
    });
  }

  return messages.filter(
    (m) =>
      m.role === 'assistant' ||
      m.role === 'tool' ||
      (typeof m.content === 'string' && m.content.length > 0)
  );
};

/** Normalize JSON Schema types (integer → number) for OpenAI-compatible APIs. */
const sanitizeSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeSchema);
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (key === 'type' && raw === 'integer') {
      next[key] = 'number';
      continue;
    }
    next[key] = sanitizeSchema(raw);
  }
  return next;
};

export const toOpenAiTools = (
  declarations: GeminiFunctionDeclaration[] | undefined
): OpenAiTool[] | undefined => {
  if (!declarations?.length) return undefined;
  return declarations.map((d) => ({
    type: 'function' as const,
    function: {
      name: d.name,
      description: d.description || d.name,
      parameters: (sanitizeSchema(
        d.parameters || { type: 'object', properties: {} }
      ) || { type: 'object', properties: {} }) as Record<string, unknown>,
    },
  }));
};

export const buildOpenAiBody = (
  request: GeminiRequest,
  model: string,
  options?: {
    stream?: boolean;
  }
): OpenAiChatBody => {
  const declarations = request.tools?.[0]?.functionDeclarations;
  const mode = request.toolConfig?.functionCallingConfig?.mode;
  const tools = toOpenAiTools(declarations);
  const gen = request.generationConfig;

  const body: OpenAiChatBody = {
    model,
    messages: toOpenAiMessages(request),
    stream: options?.stream !== false,
  };

  if (tools?.length && mode !== 'NONE') {
    body.tools = tools;
    body.tool_choice = mode === 'ANY' ? 'required' : 'auto';
  } else if (mode === 'NONE') {
    body.tool_choice = 'none';
  }

  if (gen?.temperature !== undefined) body.temperature = gen.temperature;
  if (gen?.maxOutputTokens !== undefined) body.max_tokens = gen.maxOutputTokens;

  if (gen?.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' };
  }

  return body;
};

const parseArgs = (raw: string | undefined): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const messageToGeminiResult = (
  message: {
    content?: string | null;
    tool_calls?: Array<{
      id?: string;
      function?: { name?: string; arguments?: string };
    }>;
  },
  model: string,
  usage?: GeminiUsage,
  finishReason?: string
): GeminiResult => {
  const parts: GeminiPart[] = [];
  const text = typeof message.content === 'string' ? message.content : '';
  if (text) parts.push({ text });

  const functionCalls: NonNullable<GeminiPart['functionCall']>[] = [];
  for (const tc of message.tool_calls || []) {
    const name = tc.function?.name;
    if (!name) continue;
    const fc = {
      id: tc.id,
      name,
      args: parseArgs(tc.function?.arguments),
    };
    functionCalls.push(fc);
    parts.push({ functionCall: fc });
  }

  return {
    parts,
    text,
    functionCalls,
    usage: usage || {},
    finishReason,
    model,
  };
};

export const usageFromOpenAi = (usage: any): GeminiUsage => {
  if (!usage || typeof usage !== 'object') return {};
  const prompt = usage.prompt_tokens ?? usage.promptTokenCount;
  const completion = usage.completion_tokens ?? usage.candidatesTokenCount;
  const total = usage.total_tokens ?? usage.totalTokenCount;
  return {
    promptTokenCount: typeof prompt === 'number' ? prompt : undefined,
    candidatesTokenCount:
      typeof completion === 'number' ? completion : undefined,
    totalTokenCount:
      typeof total === 'number'
        ? total
        : typeof prompt === 'number' && typeof completion === 'number'
          ? prompt + completion
          : undefined,
  };
};

/** Parses "29405s", "8h10m5s", or a plain number of seconds. */
export const parseDuration = (text: string): number | undefined => {
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

export const openAiHttpError = async (response: Response): Promise<AiError> => {
  let message = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    message =
      body?.error?.message ||
      body?.error ||
      body?.message ||
      message;
    if (typeof message !== 'string') message = JSON.stringify(message);
  } catch {
    // non-JSON
  }
  if (response.status === 429) {
    const retry =
      parseDuration(
        response.headers.get('retry-after') ||
          message.match(/retry in ([0-9.hms]+)/i)?.[1] ||
          ''
      ) || undefined;
    return new AiError('quota', message, retry, /per ?day|daily/i.test(message));
  }
  if (response.status === 401 || response.status === 403) {
    return new AiError('invalid_key', message);
  }
  if (response.status === 404) {
    return new AiError('model', message);
  }
  if (response.status === 503 || /capacity|busy|overloaded/i.test(message)) {
    return new AiError('unknown', message);
  }
  return new AiError('unknown', message);
};

async function* readOpenAiSse(response: Response, signal?: AbortSignal) {
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
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // skip malformed chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type AccumToolCall = {
  id?: string;
  name?: string;
  arguments: string;
};

/**
 * Consume an OpenAI-compatible SSE stream into a GeminiResult.
 * Text is surfaced via onText as it arrives.
 */
export async function consumeOpenAiStream(
  response: Response,
  model: string,
  onText?: (textSoFar: string) => void,
  signal?: AbortSignal
): Promise<{ result: GeminiResult; chunkCount: number }> {
  let text = '';
  let finishReason: string | undefined;
  let usage: GeminiUsage = {};
  let chunkCount = 0;
  const toolAcc = new Map<number, AccumToolCall>();

  for await (const chunk of readOpenAiSse(response, signal)) {
    chunkCount += 1;
    if (chunk?.usage) usage = usageFromOpenAi(chunk.usage);

    // Some OpenAI-compatible streams use { response: "token" }.
    if (typeof chunk?.response === 'string') {
      text += chunk.response;
      onText?.(text);
      continue;
    }

    const choice = chunk?.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta || choice.message || {};
    if (typeof delta.content === 'string') {
      text += delta.content;
      onText?.(text);
    }

    const toolDeltas = delta.tool_calls || [];
    for (const tc of toolDeltas) {
      const index = typeof tc.index === 'number' ? tc.index : 0;
      const acc = toolAcc.get(index) || { arguments: '' };
      if (tc.id) acc.id = tc.id;
      if (tc.function?.name) acc.name = tc.function.name;
      if (typeof tc.function?.arguments === 'string') {
        acc.arguments += tc.function.arguments;
      }
      toolAcc.set(index, acc);
    }

    // Non-stream-style message in a chunk
    if (choice.message?.tool_calls && !toolAcc.size) {
      for (let i = 0; i < choice.message.tool_calls.length; i++) {
        const tc = choice.message.tool_calls[i];
        toolAcc.set(i, {
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments || '',
        });
      }
    }
  }

  const tool_calls = [...toolAcc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, acc]) => ({
      id: acc.id || newToolId(),
      function: { name: acc.name || '', arguments: acc.arguments },
    }))
    .filter((tc) => tc.function.name);

  const result = messageToGeminiResult(
    { content: text, tool_calls },
    model,
    usage,
    finishReason
  );
  return { result, chunkCount };
}

/** Parse a non-streaming OpenAI-compatible JSON body. */
export const parseOpenAiCompletion = (
  body: any,
  fallbackModel: string
): GeminiResult => {
  const choice = body?.choices?.[0];
  const message = choice?.message || {
    content: body?.response ?? body?.result?.response ?? '',
    tool_calls: body?.tool_calls || body?.result?.tool_calls,
  };
  const model = body?.model || fallbackModel;
  return messageToGeminiResult(
    message,
    model,
    usageFromOpenAi(body?.usage),
    choice?.finish_reason
  );
};
