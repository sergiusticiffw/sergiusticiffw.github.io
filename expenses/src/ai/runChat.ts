import type {
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiRequest,
  GeminiResult,
} from './client';
import { AI_LIMITS } from './config';

type ToolResult = Record<string, unknown>;

/**
 * Shared state of one turn. The caller owns it so partial text, tokens and
 * notes survive when a round throws (the UI still shows what was streamed).
 */
export interface ToolLoopState {
  /** Text of every round so far, joined. */
  text: string;
  tokens: number;
  model: string | undefined;
  /** Tool names in call order, for diagnostics and evals. */
  toolCalls: string[];
}

export interface ToolLoopStep {
  request: GeminiRequest;
  round: number;
  forceAnswer: boolean;
  /** Text streamed by earlier rounds, for progressive display. */
  previousText: string;
}

export interface ToolLoopEvents {
  onRound?: (info: { round: number; forceAnswer: boolean }) => void;
  /** Called before the tools of a round run, with the first tool name. */
  onToolStart?: (firstName: string) => void;
  onToolCall?: (call: {
    id?: string;
    name: string;
    args?: Record<string, unknown>;
    response: ToolResult;
    durationMs: number;
  }) => void;
}

export interface ToolLoopInput {
  state: ToolLoopState;
  contents: GeminiContent[];
  systemInstruction: GeminiRequest['systemInstruction'];
  declarations: GeminiFunctionDeclaration[];
  /** One model call. The app passes a streaming adapter; evals pass a plain one. */
  generate: (step: ToolLoopStep) => Promise<GeminiResult>;
  executeTool: (
    name: string,
    args: Record<string, unknown> | undefined
  ) => Promise<ToolResult>;
  events?: ToolLoopEvents;
}

/**
 * Model rounds with function calling. Up to `AI_LIMITS.maxToolRounds` rounds
 * may call tools; the last round forces a plain answer. Tool calls of one
 * round run in parallel, and their responses go back in the same order.
 */
export const runToolLoop = async (
  input: ToolLoopInput
): Promise<ToolLoopState> => {
  const {
    state,
    contents,
    systemInstruction,
    declarations,
    generate,
    executeTool,
    events,
  } = input;

  for (let round = 0; round <= AI_LIMITS.maxToolRounds; round++) {
    const forceAnswer = round === AI_LIMITS.maxToolRounds;
    const request: GeminiRequest = {
      systemInstruction,
      contents,
      tools: [{ functionDeclarations: declarations }],
      ...(forceAnswer && {
        toolConfig: { functionCallingConfig: { mode: 'NONE' } },
      }),
      generationConfig: {
        maxOutputTokens: AI_LIMITS.chatMaxOutputTokens,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    };

    events?.onRound?.({ round, forceAnswer });

    const result = await generate({
      request,
      round,
      forceAnswer,
      previousText: state.text,
    });

    state.tokens += result.usage.totalTokenCount || 0;
    contents.push({ role: 'model', parts: result.parts, model: result.model });
    state.model = result.model;
    if (result.text) {
      state.text = state.text ? `${state.text}\n\n${result.text}` : result.text;
    }

    if (!result.functionCalls.length || forceAnswer) break;

    events?.onToolStart?.(result.functionCalls[0].name);
    contents.push({
      role: 'user',
      parts: await Promise.all(
        result.functionCalls.map(async (call) => {
          const started = Date.now();
          const response = await executeTool(call.name, call.args);
          state.toolCalls.push(call.name);
          events?.onToolCall?.({
            id: call.id,
            name: call.name,
            args: call.args,
            response,
            durationMs: Date.now() - started,
          });
          return {
            functionResponse: {
              ...(call.id && { id: call.id }),
              name: call.name,
              response,
            },
          };
        })
      ),
    });
  }

  return state;
};
