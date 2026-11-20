import type { AssistantTurn } from "@/lib/assistant/types";

const STORAGE_KEY = "medicalAssistantChat";
/** Which family member the chat is limited to. */
export const SCOPE_STORAGE_KEY = "medicalAssistantProfileScope";
const MAX_STORED_MESSAGES = 60;

/**
 * Chat answers contain medical details, so they live in sessionStorage: they
 * survive tab switches and reloads but disappear when the tab or installed app
 * is closed. Earlier versions used localStorage, which outlived sessions and
 * account changes on shared devices.
 */
function store(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function removeLegacyStorage() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SCOPE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readAssistantScope(): string | null {
  try {
    return store()?.getItem(SCOPE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeAssistantScope(scope: string | null) {
  try {
    if (scope) {
      store()?.setItem(SCOPE_STORAGE_KEY, scope);
    } else {
      store()?.removeItem(SCOPE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Removes every assistant trace from this device (logout, account change). */
export function clearAssistantDeviceData() {
  clearChatSession();
  writeAssistantScope(null);
  removeLegacyStorage();
}

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

function asSources(value: unknown): AssistantTurn["sources"] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const sources = value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.profile !== "string"
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        title: item.title,
        profile: item.profile,
        date: typeof item.date === "string" ? item.date : null,
        href: typeof item.href === "string" ? item.href : null,
      },
    ];
  });
  return sources.length > 0 ? sources : undefined;
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
    const sources = asSources(
      "sources" in item ? (item as { sources?: unknown }).sources : undefined,
    );
    const model =
      "model" in item && typeof item.model === "string" ? item.model : undefined;
    return [
      {
        role: item.role,
        text: item.text,
        ...(sources ? { sources } : {}),
        ...(model ? { model } : {}),
      },
    ];
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
    removeLegacyStorage();
    const stored = JSON.parse(store()?.getItem(STORAGE_KEY) || "null");
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
    store()?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full: keep the chat in memory only.
  }
}

export function clearChatSession() {
  chatSession.messages = [];
  chatSession.error = null;
  chatSession.failedModel = null;
  chatSession.awaiting = false;
  try {
    store()?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
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
