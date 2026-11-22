import type { AssistantTurn } from "@/lib/assistant/types";

const LEGACY_CHAT_KEY = "medicalAssistantChat";
/** Which family member the chat is limited to. */
export const SCOPE_STORAGE_KEY = "medicalAssistantProfileScope";
const MAX_STORED_MESSAGES = 60;

/** Auth user whose chat is bound on this device. Null = local-only / unbound. */
let boundUserId: string | null = null;

function chatKey(userId: string | null) {
  return userId ? `${LEGACY_CHAT_KEY}:${userId}` : LEGACY_CHAT_KEY;
}

function scopeKey(userId: string | null) {
  return userId ? `${SCOPE_STORAGE_KEY}:${userId}` : SCOPE_STORAGE_KEY;
}

/**
 * Chat is kept in localStorage keyed by auth user so it survives tab close and
 * can sync to Supabase. Logout clears only this device; cloud prefs remain.
 */
function store(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeLegacyUnscoped() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_CHAT_KEY);
    window.localStorage.removeItem(SCOPE_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_CHAT_KEY);
    window.sessionStorage.removeItem(SCOPE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getBoundChatUserId() {
  return boundUserId;
}

/** Bind storage keys to an auth user before load/save/hydrate. */
export function bindChatUser(userId: string | undefined | null) {
  const next =
    typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : null;
  if (boundUserId === next) {
    return;
  }
  boundUserId = next;
}

export function readAssistantScope(): string | null {
  try {
    return store()?.getItem(scopeKey(boundUserId)) ?? null;
  } catch {
    return null;
  }
}

export function writeAssistantScope(scope: string | null) {
  try {
    const key = scopeKey(boundUserId);
    if (scope) {
      store()?.setItem(key, scope);
    } else {
      store()?.removeItem(key);
    }
  } catch {
    // ignore
  }
  scheduleChatPush();
}

/** Removes every assistant trace from this device (logout, account change). Cloud prefs stay. */
export function clearAssistantDeviceData(userId?: string | null) {
  const target =
    typeof userId === "string" && userId.trim().length > 0
      ? userId.trim()
      : boundUserId;
  clearChatSession(false);
  try {
    const storage = store();
    if (storage) {
      if (target) {
        storage.removeItem(chatKey(target));
        storage.removeItem(scopeKey(target));
      }
      storage.removeItem(chatKey(null));
      storage.removeItem(scopeKey(null));
    }
  } catch {
    // ignore
  }
  removeLegacyUnscoped();
  boundUserId = null;
}

export const INTERRUPTED = "Întrerupt înainte să se termine răspunsul.";

export type StoredChat = {
  messages: AssistantTurn[];
  error: string | null;
  failedModel: string | null;
  /** True while a request is in flight — survives tab changes via localStorage. */
  awaiting: boolean;
};

export type AssistantPreferences = {
  v: 1;
  aiChat: StoredChat;
  profileScope: string | null;
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

function parseStoredChat(raw: unknown): StoredChat {
  if (!raw || typeof raw !== "object") {
    return empty();
  }
  const stored = raw as Record<string, unknown>;
  const messages = asTurns(stored.messages).slice(-MAX_STORED_MESSAGES);
  const error = typeof stored.error === "string" ? stored.error : null;
  const failedModel =
    typeof stored.failedModel === "string" ? stored.failedModel : null;
  const awaiting = stored.awaiting === true;
  return markInterrupted({ messages, error, failedModel, awaiting });
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
    removeLegacyUnscoped();
    const stored = JSON.parse(store()?.getItem(chatKey(boundUserId)) || "null");
    return parseStoredChat(stored);
  } catch {
    return empty();
  }
}

export const chatSession: StoredChat =
  typeof window === "undefined" ? empty() : empty();

export function loadChatSession(): StoredChat {
  const stored = typeof window === "undefined" ? empty() : readStorage();
  chatSession.messages = stored.messages;
  chatSession.error = stored.error;
  chatSession.failedModel = stored.failedModel;
  chatSession.awaiting = stored.awaiting;
  return stored;
}

function snapshotChat(): StoredChat {
  return {
    messages: chatSession.messages.slice(-MAX_STORED_MESSAGES),
    error: chatSession.error,
    failedModel: chatSession.failedModel,
    awaiting: chatSession.awaiting,
  };
}

function scheduleChatPush() {
  if (!boundUserId || typeof window === "undefined") {
    return;
  }
  void import("@/lib/assistant/preferences-sync")
    .then((m) =>
      m.schedulePreferencesPush({
        aiChat: readChatSessionForPrefs(),
        profileScope: readAssistantScope(),
      }),
    )
    .catch(() => undefined);
}

export function saveChatSession() {
  if (typeof window === "undefined") {
    return;
  }
  const data = snapshotChat();
  try {
    store()?.setItem(chatKey(boundUserId), JSON.stringify(data));
  } catch {
    // Storage full: keep the chat in memory only.
  }
  scheduleChatPush();
}

/** Snapshot for user_preferences sync. */
export function readChatSessionForPrefs(): StoredChat {
  return snapshotChat();
}

/** Apply chat blob from Supabase preferences (login pull). */
export function hydrateChatSessionFromPrefs(raw: unknown): void {
  const next = parseStoredChat(raw);
  chatSession.messages = next.messages;
  chatSession.error = next.error;
  chatSession.failedModel = next.failedModel;
  chatSession.awaiting = next.awaiting;
  try {
    store()?.setItem(chatKey(boundUserId), JSON.stringify(snapshotChat()));
  } catch {
    // ignore quota
  }
}

export function hydrateScopeFromPrefs(raw: unknown): void {
  const scope = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  try {
    const key = scopeKey(boundUserId);
    if (scope) {
      store()?.setItem(key, scope);
    } else {
      store()?.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function readLocalPreferences(): AssistantPreferences {
  return {
    v: 1,
    aiChat: readChatSessionForPrefs(),
    profileScope: readAssistantScope(),
  };
}

export function clearChatSession(push = true) {
  chatSession.messages = [];
  chatSession.error = null;
  chatSession.failedModel = null;
  chatSession.awaiting = false;
  try {
    store()?.removeItem(chatKey(boundUserId));
  } catch {
    // ignore
  }
  if (push) {
    scheduleChatPush();
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
