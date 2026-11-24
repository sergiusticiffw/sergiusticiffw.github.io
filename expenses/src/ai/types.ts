export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
  /** Model that produced this turn. Local only, never sent to the API. */
  model?: string;
  /**
   * Whether description sharing was on when this turn was written. Local only,
   * never sent to the API. Missing means unknown (older saved chats).
   */
  shared?: boolean;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface GeminiRequest {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: { functionDeclarations: GeminiFunctionDeclaration[] }[];
  toolConfig?: { functionCallingConfig: { mode: 'AUTO' | 'ANY' | 'NONE' } };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    thinkingConfig?: { thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' };
  };
}

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiResult {
  /** Model parts exactly as received (signatures included), for the history. */
  parts: GeminiPart[];
  text: string;
  functionCalls: NonNullable<GeminiPart['functionCall']>[];
  usage: GeminiUsage;
  finishReason?: string;
  model: string;
}

export type AiErrorKind =
  | 'invalid_key'
  | 'quota'
  | 'offline'
  | 'blocked'
  | 'model'
  | 'unknown';

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
    public retryAfterSeconds?: number,
    public daily = false,
    public quota?: { quotaId?: string; limit?: number },
    public model?: string
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export type StreamDebugEvent =
  | {
      type: 'skipped';
      model: string;
      reason: 'cooldown' | 'unavailable';
      until?: number;
    }
  | { type: 'attempt'; model: string; url: string; request: GeminiRequest }
  | {
      type: 'http_error';
      model: string;
      status: number;
      durationMs: number;
      error: AiError;
    }
  | {
      type: 'success';
      model: string;
      durationMs: number;
      chunkCount: number;
      result: GeminiResult;
    };

export interface StreamOptions {
  /** Gemini API key (primary). */
  apiKey?: string;
  /** OpenRouter API key for free-router fallback. */
  openrouterApiKey?: string;
  tier: 'chat' | 'lite';
  request: GeminiRequest;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
  /** Start from this Gemini model (and later ones). Used when retrying with an alternate. */
  preferModel?: string;
  onDebug?: (event: StreamDebugEvent) => void;
}
