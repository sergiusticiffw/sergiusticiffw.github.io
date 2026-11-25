import {
  AI_MODELS,
  AiModelTier,
  OPENROUTER_API_URL,
} from '../config';
import {
  GeminiRequest,
  GeminiResult,
  StreamDebugEvent,
} from '../types';
import {
  streamOpenAiCompat,
  testOpenAiCompatKey,
} from './openaiCompatProvider';

const openRouterHeaders = () => ({
  'HTTP-Referer':
    typeof window !== 'undefined' ? window.location.origin : '',
  'X-Title': 'Expenses Assistant',
});

export interface OpenRouterStreamOptions {
  apiKey: string;
  tier: AiModelTier;
  request: GeminiRequest;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
  onDebug?: (event: StreamDebugEvent) => void;
  preferModel?: string | 'auto';
}

export async function streamOpenRouter({
  apiKey,
  tier,
  request,
  signal,
  onText,
  onDebug,
  preferModel,
}: OpenRouterStreamOptions): Promise<GeminiResult> {
  const models =
    tier === 'lite'
      ? [...AI_MODELS.openrouterLite]
      : [...AI_MODELS.openrouterChat];
  return streamOpenAiCompat({
    apiKey,
    baseUrl: OPENROUTER_API_URL,
    models,
    preferModel,
    label: 'OpenRouter',
    request,
    signal,
    onText,
    onDebug,
    extraHeaders: openRouterHeaders,
  });
}

/** Validates an OpenRouter key with a tiny free-router completion. */
export async function testOpenRouterApiKey(apiKey: string): Promise<string> {
  return testOpenAiCompatKey(
    apiKey,
    OPENROUTER_API_URL,
    AI_MODELS.openrouterChat[0],
    openRouterHeaders
  );
}

