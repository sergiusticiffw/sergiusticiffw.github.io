import type { AssistantTurn } from "@/lib/assistant/types";

const STORAGE_KEY = "medicalAssistantChat";
const MAX_STORED_MESSAGES = 60;
const INTERRUPTED = "Întrerupt înainte să se termine răspunsul.";

export type StoredChat = {
  messages: AssistantTurn[];
  error: string | null;
  failedModel: string | null;
};

function empty(): StoredChat {
  return { messages: [], error: null, failedModel: null };
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

function markInterrupted(chat: StoredChat): StoredChat {
  const last = chat.messages.at(-1);
  if (last?.role === "user" && !chat.error) {
    return { ...chat, error: INTERRUPTED };
  }
  return chat;
}

function readStorage(): StoredChat {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const messages = asTurns(stored?.messages).slice(-MAX_STORED_MESSAGES);
    const error = typeof stored?.error === "string" ? stored.error : null;
    const failedModel =
      typeof stored?.failedModel === "string" ? stored.failedModel : null;
    return markInterrupted({ messages, error, failedModel });
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
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", saveChatSession);
}
