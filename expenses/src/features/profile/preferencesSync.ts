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
    onboardingComplete: !!settingsStore.state.onboardingComplete,
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

export const flushPreferencesPush = async (): Promise<void> => {
  if (applyingRemote) return;
  if (getDataProviderKind() !== 'supabase') return;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token) return;

  const patch = pendingPatch;
  pendingPatch = {};
  const next = mergePreferences(readLocalPreferences(), patch);

  try {
    const provider = getDataProvider();
    provider.configure(token);
    await provider.updateProfile(session.uid, { preferences: next });
  } catch {
    // Keep local; next edit retries.
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
  if (!session?.uid || !token) return false;

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
  await flushPreferencesPush();
  return true;
};

/** Pull prefs from profile after Supabase login. Remote wins for missing locals. */
export const pullPreferencesFromProfile = async (): Promise<boolean> => {
  if (getDataProviderKind() !== 'supabase') return false;
  const session = getSession();
  const token = getStoredToken();
  if (!session?.uid || !token || !navigator.onLine) return false;

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
