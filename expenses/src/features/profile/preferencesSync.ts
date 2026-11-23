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
  setLoansEnabled,
  setNetWorthEnabled,
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
  hydrateAiUsageFromPrefs,
  readAiUsageForPrefs,
} from '../../ai/sessionStats';
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
import {
  getNetWorthAssets,
  getNetWorthCash,
  hydrateNetWorthAssetsFromPrefs,
  hydrateNetWorthCashFromPrefs,
} from '../netWorth/assetsStore';

const DEBOUNCE_MS = 500;
const LANG_EVENT = 'expenses:prefs-language';
const PREFS_APPLIED_EVENT = 'expenses:prefs-applied';

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
    netWorthEnabled: !!settingsStore.state.netWorthEnabled,
    loansEnabled: !!settingsStore.state.loansEnabled,
    visibleCharts: readStoredVisibleCharts(),
    customChartsEnabled: readCustomChartsEnabled(),
    aiLanguage: getAiLanguage(),
    aiShareDescriptions: getShareDescriptions(),
    aiChat: readChatSessionForPrefs(),
    aiUsage: readAiUsageForPrefs(),
    emergencyFund: fund as unknown as Record<string, unknown>,
    netWorthCash: getNetWorthCash(),
    netWorthAssets: getNetWorthAssets() as unknown as Record<string, unknown>,
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
    if (typeof p.netWorthEnabled === 'boolean') {
      setNetWorthEnabled(p.netWorthEnabled);
    }
    if (typeof p.loansEnabled === 'boolean') {
      setLoansEnabled(p.loansEnabled);
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
    if (p.aiUsage != null) {
      hydrateAiUsageFromPrefs(p.aiUsage);
    }
    if (p.emergencyFund && typeof p.emergencyFund === 'object') {
      const remote = normalizeEmergencyFund(p.emergencyFund);
      const merged = newerEmergencyFund(getEmergencyFund(), remote);
      replaceEmergencyFund(merged);
    }
    if (p.netWorthAssets && typeof p.netWorthAssets === 'object') {
      hydrateNetWorthAssetsFromPrefs(p.netWorthAssets);
    } else if (typeof p.netWorthCash === 'number') {
      hydrateNetWorthCashFromPrefs(p.netWorthCash);
    }
  } finally {
    // Allow microtasks from setters to finish before re-enabling push.
    void Promise.resolve().then(() => {
      applyingRemote = false;
      window.dispatchEvent(new CustomEvent(PREFS_APPLIED_EVENT));
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

/** True when Supabase client has a non-expired access token (or can refresh/restore). */
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

    // Prefer client refresh when a refresh token is already in auth storage.
    if (data.session?.refresh_token) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && !!refreshed.session?.access_token) return true;
    }

    // Same fallback as the data provider: restore from app-stored tokens.
    // Without this, prefs flush fails while currency/profile API still works.
    const access = getStoredToken();
    let refresh = '';
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}') as {
        refresh_token?: string;
        refreshToken?: string;
      };
      refresh = stored.refresh_token || stored.refreshToken || '';
    } catch {
      refresh = '';
    }
    if (!access || !refresh) return false;

    const { data: restored, error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    return !error && !!restored.session?.access_token;
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

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
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
      // The whole preferences object is replaced below: fold in the other
      // devices' usage first so this write never erases it.
      if (remote?.aiUsage != null) hydrateAiUsageFromPrefs(remote.aiUsage);
      next.aiUsage = readAiUsageForPrefs();
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
 * Persist UI language to Supabase profiles.preferences immediately.
 * Returns false when offline / not Supabase / not signed in / push failed.
 */
export const persistLanguageToSupabase = async (
  language: 'en' | 'ro'
): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  if (!navigator.onLine) return false;
  schedulePreferencesPush({ language });
  return flushPreferencesPush();
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

/**
 * Persist Charts visibility settings to Supabase profiles.preferences immediately.
 * Returns false when offline / not Supabase / not signed in / push failed.
 */
export const persistChartsToSupabase = async (options?: {
  visibleCharts?: string[];
  customChartsEnabled?: boolean;
}): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  if (!navigator.onLine) return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid)) return false;

  schedulePreferencesPush({
    visibleCharts: options?.visibleCharts ?? readStoredVisibleCharts(),
    customChartsEnabled:
      options?.customChartsEnabled !== undefined
        ? options.customChartsEnabled
        : readCustomChartsEnabled(),
  });
  return flushPreferencesPush();
};

/**
 * Persist Loans enabled flag to Supabase profiles.preferences immediately.
 * Returns false when offline / not Supabase / not signed in / push failed.
 * No-op on Drupal (caller should toast local-only).
 */
export const persistLoansToSupabase = async (options?: {
  enabled?: boolean;
}): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  if (!navigator.onLine) return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid)) return false;

  const enabled =
    options?.enabled !== undefined
      ? options.enabled
      : !!settingsStore.state.loansEnabled;

  schedulePreferencesPush({ loansEnabled: enabled });
  return flushPreferencesPush();
};

/**
 * Persist Net Worth (enabled + assets) to Supabase profiles.preferences immediately.
 * Returns false when offline / not Supabase / not signed in / push failed.
 */
export const persistNetWorthToSupabase = async (options?: {
  enabled?: boolean;
  assets?: Record<string, unknown>;
}): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  if (!navigator.onLine) return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !isUuid(session.uid)) return false;

  const assets =
    options?.assets != null
      ? options.assets
      : (getNetWorthAssets() as unknown as Record<string, unknown>);
  const enabled =
    options?.enabled !== undefined
      ? options.enabled
      : !!settingsStore.state.netWorthEnabled;

  schedulePreferencesPush({
    netWorthEnabled: enabled,
    netWorthCash:
      typeof (assets as { cash?: unknown }).cash === 'number'
        ? (assets as { cash: number }).cash
        : getNetWorthCash(),
    netWorthAssets: assets,
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

export { LANG_EVENT, PREFS_APPLIED_EVENT };
