import type { GeminiContent } from './client';
import { AI_LIMITS, AI_MODELS, AI_STORAGE_KEYS } from './config';

export interface TransactionPrefill {
  field_category: string;
  field_description: string;
  field_amount?: string;
  field_date?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'streaming' | 'done' | 'error' | 'stopped';
  activity?: string;
  tokens?: number;
  model?: string;
  /** Model that failed this turn, used to offer retry with the next one. */
  failedModel?: string;
  /** Short next offers the model attached to this answer. */
  followUps?: string[];
  /** Prefill for Add Transaction when suggest_category (or similar) ran. */
  prefill?: TransactionPrefill;
}

/** Messages kept on the device; older ones are dropped. */
const MAX_STORED_MESSAGES = 60;
const MAX_TOOL_NOTES = 3;

const interruptedText = () =>
  localStorage.getItem('language') === 'ro'
    ? 'Întrerupt înainte să se termine răspunsul.'
    : 'Interrupted before the answer finished.';

/** An answer that was streaming when the chat closed can't be resumed; it becomes retryable. */
export const markInterrupted = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((m) =>
    m.status === 'streaming'
      ? {
          ...m,
          status: 'error',
          activity: undefined,
          text: m.text || interruptedText(),
          // So "Retry with another model" can offer the next candidate.
          failedModel: m.failedModel || m.model || AI_MODELS.chat[0],
        }
      : m
  );

const sanitizeFollowUps = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const questions = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length >= 8 && item.length <= 140)
    .slice(0, 3);
  return questions.length ? questions : undefined;
};

const sanitizePrefill = (value: unknown): TransactionPrefill | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const field_category = String(raw.field_category || '').trim();
  const field_description = String(raw.field_description || '').trim();
  if (!field_category && !field_description) return undefined;
  return {
    field_category,
    field_description,
    ...(typeof raw.field_amount === 'string' && raw.field_amount
      ? { field_amount: raw.field_amount }
      : {}),
    ...(typeof raw.field_date === 'string' && raw.field_date
      ? { field_date: raw.field_date }
      : {}),
  };
};

const load = (): {
  messages: ChatMessage[];
  history: GeminiContent[];
  toolNotes: string[];
} => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(AI_STORAGE_KEYS.chat) || 'null'
    );
    if (!Array.isArray(stored?.messages) || !Array.isArray(stored?.history)) {
      throw new Error();
    }
    return {
      messages: markInterrupted(
        stored.messages.map((message: ChatMessage) => ({
          ...message,
          followUps: sanitizeFollowUps(message.followUps),
          prefill: sanitizePrefill(message.prefill),
        }))
      ),
      history: stored.history,
      toolNotes: Array.isArray(stored.toolNotes)
        ? stored.toolNotes
            .filter((note: unknown): note is string => typeof note === 'string')
            .map((note: string) => note.trim())
            .filter(Boolean)
            .slice(-MAX_TOOL_NOTES)
        : [],
    };
  } catch {
    return { messages: [], history: [], toolNotes: [] };
  }
};

/**
 * The conversation, kept in memory and in localStorage so it survives
 * navigation and reloads. Cleared on logout and on "New chat".
 */
export const chatSession: {
  messages: ChatMessage[];
  history: GeminiContent[];
  /** Compact tool summaries from recent turns, injected into the next system prompt. */
  toolNotes: string[];
} = load();

export const saveChatSession = () => {
  const data = {
    messages: chatSession.messages.slice(-MAX_STORED_MESSAGES),
    history: chatSession.history.slice(-AI_LIMITS.maxHistoryTurns * 2),
    toolNotes: chatSession.toolNotes.slice(-MAX_TOOL_NOTES),
  };
  try {
    localStorage.setItem(AI_STORAGE_KEYS.chat, JSON.stringify(data));
  } catch {
    // Storage full: keep the chat in memory only.
  }
};

// Saves the in-progress question too when the page is reloaded or closed mid-answer.
window.addEventListener('pagehide', saveChatSession);

export const clearChatSession = () => {
  chatSession.messages = [];
  chatSession.history = [];
  chatSession.toolNotes = [];
  localStorage.removeItem(AI_STORAGE_KEYS.chat);
};

export const pushToolNotes = (lines: string[]) => {
  const note = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  if (!note) return;
  chatSession.toolNotes = [...chatSession.toolNotes, note].slice(-MAX_TOOL_NOTES);
};

export const recentToolNotesText = () => chatSession.toolNotes.join('\n---\n');
