import type { AssistantTurn } from "@/lib/assistant/types";

const STORAGE_KEY = "medicalAssistantChat";
const MAX_STORED_MESSAGES = 60;

export const INTERRUPTED = "Întrerupt înainte să se termine răspunsul.";

export type StoredChat = {
  messages: AssistantTurn[];
  error: string | null;
  failedModel: string | null;
  /** True while a request is in flight — survives tab changes via localStorage. */
  awaiting: boolean;
};

function empty(): StoredChat {
  return { messages: [], error: null, failedModel: null, awaiting: false };
}

function asTurns(value: unknown): AssistantTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.text !== "string" ||
      item.text.trim().length === 0
    ) {
      return [];
    }
    return [{ role: item.role, text: item.text }];
  });
}

/** A question left without an answer (nav away / reload) becomes retryable. */
export function markInterrupted(chat: StoredChat): StoredChat {
  const last = chat.messages.at(-1);
  if (chat.awaiting || (last?.role === "user" && !chat.error)) {
    return {
      ...chat,
      error: chat.error || INTERRUPTED,
      awaiting: false,
    };
  }
  return { ...chat, awaiting: false };
}

function readStorage(): StoredChat {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const messages = asTurns(stored?.messages).slice(-MAX_STORED_MESSAGES);
    const error = typeof stored?.error === "string" ? stored.error : null;
    const failedModel =
      typeof stored?.failedModel === "string" ? stored.failedModel : null;
    const awaiting = stored?.awaiting === true;
    return markInterrupted({ messages, error, failedModel, awaiting });
  } catch {
    return empty();
  }
}

export const chatSession: StoredChat =
  typeof window === "undefined" ? empty() : readStorage();

export function loadChatSession(): StoredChat {
  const stored = typeof window === "undefined" ? empty() : readStorage();
  chatSession.messages = stored.messages;
  chatSession.error = stored.error;
  chatSession.failedModel = stored.failedModel;
  chatSession.awaiting = stored.awaiting;
  return stored;
}

export function saveChatSession() {
  if (typeof window === "undefined") {
    return;
  }
  const data: StoredChat = {
    messages: chatSession.messages.slice(-MAX_STORED_MESSAGES),
    error: chatSession.error,
    failedModel: chatSession.failedModel,
    awaiting: chatSession.awaiting,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full: keep the chat in memory only.
  }
}

export function clearChatSession() {
  chatSession.messages = [];
  chatSession.error = null;
  chatSession.failedModel = null;
  chatSession.awaiting = false;
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (chatSession.awaiting) {
      Object.assign(chatSession, markInterrupted(chatSession));
    }
    saveChatSession();
  });
}
