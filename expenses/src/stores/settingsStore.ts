/**
 * User preferences: currency, theme, chart options. Persisted to localStorage.
 */
import { Store, useStore } from '@tanstack/react-store';
import type { SettingsState } from '@shared/type/types';

const THEME_KEY = 'theme';
const CHARTS_BG_KEY = 'useChartsBackgroundColor';

function readTheme(): string {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v ? JSON.parse(v) : 'blue-pink-gradient';
  } catch {
    return 'blue-pink-gradient';
  }
}

function readChartsBg(): boolean {
  try {
    const v = localStorage.getItem(CHARTS_BG_KEY);
    return v ? JSON.parse(v) : false;
  } catch {
    return false;
  }
}

const initialState: SettingsState = {
  currency: 'MDL',
  theme: readTheme(),
  useChartsBackgroundColor: readChartsBg(),
};

const settingsStore = new Store<SettingsState>(initialState);

export function useSettings(): SettingsState {
  return useStore(settingsStore);
}

export function useSettingsCurrency(): string {
  return useStore(settingsStore, (s) => s.currency);
}

export function useSettingsTheme(): string {
  return useStore(settingsStore, (s) => s.theme);
}

export function useChartsBackground(): boolean {
  return useStore(settingsStore, (s) => s.useChartsBackgroundColor);
}

export function setSettingsCurrency(currency: string): void {
  settingsStore.setState((s) => ({ ...s, currency }));
}

export function setSettingsTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  settingsStore.setState((s) => ({ ...s, theme }));
}

export function setChartsBackground(value: boolean): void {
  localStorage.setItem(CHARTS_BG_KEY, JSON.stringify(value));
  settingsStore.setState((s) => ({ ...s, useChartsBackgroundColor: value }));
}

export function hydrateSettings(partial: Partial<SettingsState>): void {
  settingsStore.setState((s) => ({ ...s, ...partial }));
}

export { settingsStore };
