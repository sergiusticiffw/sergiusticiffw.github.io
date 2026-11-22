/**
 * Sync assistant prefs between localStorage and Supabase user_preferences.
 * Chat + profile scope only — AI usage stays in ai_usage_days (family quota).
 */
import {
  getBoundChatUserId,
  hydrateChatSessionFromPrefs,
  hydrateScopeFromPrefs,
  readLocalPreferences,
  type AssistantPreferences,
  type StoredChat,
} from "@/lib/assistant/chat-session";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 500;

export type PreferencesPatch = {
  aiChat?: StoredChat;
  profileScope?: string | null;
};

let applyingRemote = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPatch: PreferencesPatch = {};
let flushInFlight: Promise<boolean> | null = null;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );

function mergePreferences(
  base: AssistantPreferences,
  patch: PreferencesPatch,
): AssistantPreferences {
  return {
    v: 1,
    aiChat: patch.aiChat ?? base.aiChat,
    profileScope:
      patch.profileScope !== undefined ? patch.profileScope : base.profileScope,
  };
}

function restorePending(patch: PreferencesPatch) {
  pendingPatch = { ...patch, ...pendingPatch };
}

function asRemotePreferences(raw: unknown): AssistantPreferences | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  return {
    v: 1,
    aiChat: (row.aiChat as StoredChat) ?? {
      messages: [],
      error: null,
      failedModel: null,
      awaiting: false,
    },
    profileScope:
      typeof row.profileScope === "string"
        ? row.profileScope
        : row.profileScope === null
          ? null
          : null,
  };
}

/** Debounced push of local assistant prefs to Supabase. */
export function schedulePreferencesPush(patch?: PreferencesPatch): void {
  if (applyingRemote) {
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  const userId = getBoundChatUserId();
  if (!userId || !isUuid(userId)) {
    return;
  }

  if (patch) {
    pendingPatch = { ...pendingPatch, ...patch };
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushPreferencesPush();
  }, DEBOUNCE_MS);
}

export async function flushPreferencesPush(): Promise<boolean> {
  if (applyingRemote) {
    return false;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  const userId = getBoundChatUserId();
  if (!userId || !isUuid(userId)) {
    return false;
  }

  if (flushInFlight) {
    return flushInFlight;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const patch = pendingPatch;
  pendingPatch = {};
  const next = mergePreferences(readLocalPreferences(), patch);

  flushInFlight = (async () => {
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token || auth.session.user.id !== userId) {
        restorePending(patch);
        return false;
      }

      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          preferences: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("flushPreferencesPush", error.code);
        restorePending(patch);
        return false;
      }
      return true;
    } catch (error) {
      console.error(
        "flushPreferencesPush",
        error instanceof Error ? error.name : "unknown",
      );
      restorePending(patch);
      return false;
    } finally {
      flushInFlight = null;
    }
  })();

  return flushInFlight;
}

/**
 * Pull preferences for the bound auth user and hydrate local chat/scope.
 * Returns the hydrated local snapshot (or null when nothing applied).
 */
export async function pullPreferences(
  userId: string,
): Promise<AssistantPreferences | null> {
  if (!isUuid(userId)) {
    return null;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return readLocalPreferences();
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        console.error("pullPreferences", error.code);
      }
      return readLocalPreferences();
    }

    const remote = asRemotePreferences(
      data && typeof data === "object" && "preferences" in data
        ? (data as { preferences: unknown }).preferences
        : null,
    );

    if (!remote) {
      return readLocalPreferences();
    }

    applyingRemote = true;
    try {
      hydrateChatSessionFromPrefs(remote.aiChat);
      hydrateScopeFromPrefs(remote.profileScope);
    } finally {
      applyingRemote = false;
    }

    return readLocalPreferences();
  } catch (error) {
    console.error(
      "pullPreferences",
      error instanceof Error ? error.name : "unknown",
    );
    return readLocalPreferences();
  }
}
