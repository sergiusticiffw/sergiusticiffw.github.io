/**
 * User preferences: currency, theme, chart options. Persisted to localStorage.
 */
import { Store, useStore } from '@tanstack/react-store';
import type { SettingsState } from '@shared/type/types';
import { DEFAULT_THEME_ID, normalizeThemeId } from '@shared/constants/themes';

const THEME_KEY = 'theme';
const COMPACT_DENSITY_KEY = 'compactListDensity';
const CATEGORY_ICONS_KEY = 'showCategoryIcons';
const ONBOARDING_KEY = 'onboardingComplete';

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v != null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function readTheme(): string {
  try {
    const v = localStorage.getItem(THEME_KEY);
    const raw = v ? JSON.parse(v) : DEFAULT_THEME_ID;
    return normalizeThemeId(raw);
  } catch {
    return DEFAULT_THEME_ID;
  }
}

const initialState: SettingsState = {
  currency: 'MDL',
  theme: readTheme(),
  compactListDensity: readJson(COMPACT_DENSITY_KEY, false),
  showCategoryIcons: readJson(CATEGORY_ICONS_KEY, true),
  onboardingComplete: readJson(ONBOARDING_KEY, false),
};

const settingsStore = new Store<SettingsState>(initialState);

export function useSettings(): SettingsState {
  return useStore(settingsStore, (s) => s);
}

export function useSettingsCurrency(): string {
  return useStore(settingsStore, (s) => s.currency);
}

export function useSettingsTheme(): string {
  return useStore(settingsStore, (s) => s.theme);
}

export function useCompactListDensity(): boolean {
  return useStore(settingsStore, (s) => s.compactListDensity);
}

export function useShowCategoryIcons(): boolean {
  return useStore(settingsStore, (s) => s.showCategoryIcons);
}

export function useOnboardingComplete(): boolean {
  return useStore(settingsStore, (s) => s.onboardingComplete);
}

function persist<K extends keyof SettingsState>(key: string, value: SettingsState[K]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function setSettingsCurrency(currency: string): void {
  settingsStore.setState((s) => ({ ...s, currency }));
}

export function setSettingsTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  settingsStore.setState((s) => ({ ...s, theme }));
}

export function setCompactListDensity(value: boolean): void {
  persist(COMPACT_DENSITY_KEY, value);
  settingsStore.setState((s) => ({ ...s, compactListDensity: value }));
}

export function setShowCategoryIcons(value: boolean): void {
  persist(CATEGORY_ICONS_KEY, value);
  settingsStore.setState((s) => ({ ...s, showCategoryIcons: value }));
}

export function setOnboardingComplete(value: boolean): void {
  persist(ONBOARDING_KEY, value);
  settingsStore.setState((s) => ({ ...s, onboardingComplete: value }));
}

export function hydrateSettings(partial: Partial<SettingsState>): void {
  settingsStore.setState((s) => ({ ...s, ...partial }));
}

export { settingsStore };
