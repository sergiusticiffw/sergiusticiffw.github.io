/**
 * User preferences: currency, theme, chart options. Persisted to localStorage.
 */
import { Store, useStore } from '@tanstack/react-store';
import type {
  SettingsState,
  QuickAddSuggestionConfig,
  TimeSlot,
} from '@shared/type/types';
import { DEFAULT_THEME_ID, normalizeThemeId } from '@shared/constants/themes';

const THEME_KEY = 'theme';
const CHARTS_BG_KEY = 'useChartsBackgroundColor';
const QUICK_ADD_SUGGESTION_KEY = 'quickAddSuggestion';

function readTheme(): string {
  try {
    const v = localStorage.getItem(THEME_KEY);
    const raw = v ? JSON.parse(v) : DEFAULT_THEME_ID;
    return normalizeThemeId(raw);
  } catch {
    return DEFAULT_THEME_ID;
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

const defaultQuickAdd: QuickAddSuggestionConfig = {
  enabled: false,
  amount: '',
  category: '',
  description: '',
  daysOfWeek: [],
  timeSlots: [],
};

function normalizeTimeSlot(s: unknown): TimeSlot | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const start = typeof o.start === 'string' ? o.start : '';
  const end = typeof o.end === 'string' ? o.end : '';
  if (!start || !end) return null;
  return { start, end };
}

function readQuickAddSuggestion(): QuickAddSuggestionConfig {
  try {
    const v = localStorage.getItem(QUICK_ADD_SUGGESTION_KEY);
    if (!v) return defaultQuickAdd;
    const parsed = JSON.parse(v) as Record<string, unknown>;
    const daysOfWeek = Array.isArray(parsed.daysOfWeek)
      ? (parsed.daysOfWeek as number[]).filter((d) => typeof d === 'number' && d >= 0 && d <= 6)
      : [];
    const rawSlots = Array.isArray(parsed.timeSlots) ? parsed.timeSlots : [];
    const timeSlots = rawSlots
      .map(normalizeTimeSlot)
      .filter((s): s is TimeSlot => s !== null);
    return {
      enabled: !!parsed.enabled,
      amount: typeof parsed.amount === 'string' ? parsed.amount : '',
      category: typeof parsed.category === 'string' ? parsed.category : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      daysOfWeek,
      timeSlots,
    };
  } catch {
    return defaultQuickAdd;
  }
}

const initialState: SettingsState = {
  currency: 'MDL',
  theme: readTheme(),
  useChartsBackgroundColor: readChartsBg(),
  quickAddSuggestion: readQuickAddSuggestion(),
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

export function useQuickAddSuggestion(): QuickAddSuggestionConfig {
  return useStore(settingsStore, (s) => s.quickAddSuggestion);
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

export function setQuickAddSuggestion(config: QuickAddSuggestionConfig): void {
  localStorage.setItem(QUICK_ADD_SUGGESTION_KEY, JSON.stringify(config));
  settingsStore.setState((s) => ({ ...s, quickAddSuggestion: config }));
}

export function hydrateSettings(partial: Partial<SettingsState>): void {
  settingsStore.setState((s) => ({ ...s, ...partial }));
}

export { settingsStore };
