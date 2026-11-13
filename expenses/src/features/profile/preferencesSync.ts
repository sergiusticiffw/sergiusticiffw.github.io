/**
 * Sync portable UI prefs between localStorage and Supabase profiles.preferences.
 * No-op on Drupal provider.
 */
import { getDataProvider, getDataProviderKind } from '../../data';
import type { ProfilePreferences } from '../../data/types';
import { getStoredToken } from '@shared/utils/authStorage';
import { getSession } from '../../crypto/encryptionState';
import {
  hydrateSettings,
  setGoalsEnabled,
  setOnboardingComplete,
  setSettingsTheme,
  settingsStore,
} from '../../stores/settingsStore';
import {
  readCustomChartsEnabled,
  readStoredVisibleCharts,
  writeCustomChartsEnabled,
  writeStoredVisibleCharts,
} from '@shared/utils/chartsVisibility';
import {
  getAiLanguage,
  getShareDescriptions,
  setAiLanguage,
  setShareDescriptions,
} from '../../ai/storage';
import {
  hydrateChatSessionFromPrefs,
  readChatSessionForPrefs,
} from '../../ai/chatSession';
import {
  getEmergencyFund,
  replaceEmergencyFund,
} from '../goals/store';
import {
  newerEmergencyFund,
  normalizeEmergencyFund,
  type EmergencyFundState,
} from '../goals/model';
import { DEFAULT_THEME_ID, normalizeThemeId } from '@shared/constants/themes';

const DEBOUNCE_MS = 500;
const LANG_EVENT = 'expenses:prefs-language';

let applyingRemote = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPatch: Partial<ProfilePreferences> = {};

export const isApplyingRemotePreferences = () => applyingRemote;

const readLanguage = (): string => {
  const raw = localStorage.getItem('language');
  return raw === 'ro' || raw === 'en' ? raw : 'en';
};

export const readLocalPreferences = (): ProfilePreferences => {
  const fund = getEmergencyFund();
  return {
    v: 1,
    theme: settingsStore.state.theme || DEFAULT_THEME_ID,
    language: readLanguage(),
    // onboardingComplete is never taken from local defaults — see flushPreferencesPush.
    goalsEnabled: !!settingsStore.state.goalsEnabled,
    visibleCharts: readStoredVisibleCharts(),
    customChartsEnabled: readCustomChartsEnabled(),
    aiLanguage: getAiLanguage(),
    aiShareDescriptions: getShareDescriptions(),
    aiChat: readChatSessionForPrefs(),
    emergencyFund: fund as unknown as Record<string, unknown>,
  };
};

export const applyPreferencesLocally = (
  prefs: ProfilePreferences | Record<string, unknown> | null | undefined
): void => {
  if (!prefs || typeof prefs !== 'object') return;
  applyingRemote = true;
  try {
    const p = prefs as ProfilePreferences;
    if (typeof p.theme === 'string' && p.theme) {
      setSettingsTheme(normalizeThemeId(p.theme));
    }
    if (p.language === 'en' || p.language === 'ro') {
      localStorage.setItem('language', p.language);
      window.dispatchEvent(
        new CustomEvent(LANG_EVENT, { detail: p.language })
      );
    }
    if (typeof p.onboardingComplete === 'boolean') {
      setOnboardingComplete(p.onboardingComplete);
    }
    if (typeof p.goalsEnabled === 'boolean') {
      setGoalsEnabled(p.goalsEnabled);
    }
    if (Array.isArray(p.visibleCharts)) {
      writeStoredVisibleCharts(p.visibleCharts.filter((c) => typeof c === 'string'));
    }
    if (typeof p.customChartsEnabled === 'boolean') {
      writeCustomChartsEnabled(p.customChartsEnabled);
    }
    if (typeof p.aiLanguage === 'string' && p.aiLanguage) {
      setAiLanguage(p.aiLanguage);
    }
    if (typeof p.aiShareDescriptions === 'boolean') {
      setShareDescriptions(p.aiShareDescriptions);
    }
    if (p.aiChat != null) {
      hydrateChatSessionFromPrefs(p.aiChat);
    }
    if (p.emergencyFund && typeof p.emergencyFund === 'object') {
      const remote = normalizeEmergencyFund(p.emergencyFund);
      const merged = newerEmergencyFund(getEmergencyFund(), remote);
      replaceEmergencyFund(merged);
    }
  } finally {
    // Allow microtasks from setters to finish before re-enabling push.
    queuePromise.resolve().then(() => {
      applyingRemote = false;
    });
  }
};

const mergePreferences = (
  base: ProfilePreferences,
  patch: Partial<ProfilePreferences>
): ProfilePreferences => ({
  ...base,
  ...patch,
  v: 1,
});

/** Debounced push of local prefs (or a partial patch) to Supabase profiles. */
export const schedulePreferencesPush = (
  patch?: Partial<ProfilePreferences>
): void => {
  if (applyingRemote) return;
  if (getDataProviderKind() !== 'supabase') return;
  if (!navigator.onLine) return;

  if (patch) {
    pendingPatch = { ...pendingPatch, ...patch };
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushPreferencesPush();
  }, DEBOUNCE_MS);
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

const restorePending = (patch: Partial<ProfilePreferences>) => {
  pendingPatch = { ...patch, ...pendingPatch };
};

/** True when Supabase client has a non-expired access token (or can refresh). */
export const ensureFreshSupabaseSession = async (): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  try {
    const { getSupabaseClient } = await import(
      '../../data/providers/supabase/client'
    );
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const expiresAt = data.session?.expires_at ?? 0;
    const fresh =
      !!data.session?.access_token &&
      expiresAt > Math.floor(Date.now() / 1000) + 30;
    if (fresh) return true;
    // No refresh token → skip quietly (do not hit /auth/v1/token).
    if (!data.session?.refresh_token) return false;

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    return !error && !!refreshed.session?.access_token;
  } catch {
    return false;
  }
};

export const flushPreferencesPush = async (): Promise<boolean> => {
  if (applyingRemote) return false;
  if (getDataProviderKind() !== 'supabase') return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid)) return false;
  if (!(await ensureFreshSupabaseSession())) {
    return false;
  }

  const patch = pendingPatch;
  pendingPatch = {};
  const next = mergePreferences(readLocalPreferences(), patch);

  try {
    const { getSupabaseClient } = await import(
      '../../data/providers/supabase/client'
    );
    const { data: auth } = await getSupabaseClient().auth.getSession();
    const liveToken = auth.session?.access_token;
    if (!liveToken) {
      restorePending(patch);
      return false;
    }

    const provider = getDataProvider();
    provider.configure(liveToken);

    // Full preferences replace would otherwise clobber onboardingComplete with
    // the local default (false). Only rewrite it when explicitly patched.
    if (!Object.prototype.hasOwnProperty.call(patch, 'onboardingComplete')) {
      const existing = await provider.getProfile(session.uid);
      if (!existing.success) {
        restorePending(patch);
        return false;
      }
      const remote = existing.data?.preferences as
        | ProfilePreferences
        | undefined;
      if (typeof remote?.onboardingComplete === 'boolean') {
        next.onboardingComplete = remote.onboardingComplete;
      } else {
        delete next.onboardingComplete;
      }
    }

    const result = await provider.updateProfile(session.uid, {
      preferences: next,
    });
    if (!result.success) {
      restorePending(patch);
      return false;
    }

    // Keep local UI in sync with whatever we persisted (no re-push).
    if (typeof next.onboardingComplete === 'boolean') {
      applyingRemote = true;
      try {
        localStorage.setItem(
          'onboardingComplete',
          JSON.stringify(next.onboardingComplete)
        );
        settingsStore.setState((s) => ({
          ...s,
          onboardingComplete: next.onboardingComplete as boolean,
        }));
      } finally {
        void Promise.resolve().then(() => {
          applyingRemote = false;
        });
      }
    }
    return true;
  } catch {
    restorePending(patch);
    return false;
  }
};

/**
 * Persist Goals (emergency fund + enabled flag) to Supabase profiles.preferences.
 * No Google Drive. Returns false when offline / not Supabase / not signed in.
 */
export const persistGoalsToSupabase = async (options?: {
  fund?: EmergencyFundState | Record<string, unknown>;
  enabled?: boolean;
}): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  if (!navigator.onLine) return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid)) return false;

  const fund =
    options?.fund != null
      ? (options.fund as Record<string, unknown>)
      : (getEmergencyFund() as unknown as Record<string, unknown>);
  const enabled =
    options?.enabled !== undefined
      ? options.enabled
      : !!settingsStore.state.goalsEnabled;

  schedulePreferencesPush({
    emergencyFund: fund,
    goalsEnabled: enabled,
  });
  return flushPreferencesPush();
};

/** Pull prefs from profile after Supabase login. Remote wins for missing locals. */
export const pullPreferencesFromProfile = async (): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid) || !navigator.onLine) {
    return false;
  }

  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.getProfile(session.uid);
    if (!result.success || !result.data?.preferences) return false;
    applyPreferencesLocally(result.data.preferences);
    // Also hydrate currency from profile columns if present.
    if (result.data.currency) {
      hydrateSettings({ currency: result.data.currency });
    }
    return true;
  } catch {
    return false;
  }
};

export { LANG_EVENT };
