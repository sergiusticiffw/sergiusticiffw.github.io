/**
 * App color themes – listă scurtă, trend financial apps (încredere, profesional, growth).
 * Aplicat prin data-theme pe <html>; în index.css există [data-theme="..."] pentru fiecare.
 */
export interface ThemeDefinition {
  id: string;
  labelKey: string;
  /** CSS value for --color-app-bg (background) */
  bg: string;
  /** CSS value for --color-app-accent */
  accent: string;
  /** CSS value for --color-app-accent-hover */
  accentHover: string;
}

export const APP_THEMES: ThemeDefinition[] = [
  { id: 'default', labelKey: 'theme.default', bg: 'oklch(0.145 0.005 264)', accent: '#5b8def', accentHover: 'oklch(0.52 0.18 264)' },
  { id: 'emerald', labelKey: 'theme.emerald', bg: 'oklch(0.12 0.02 165)', accent: '#10b981', accentHover: 'oklch(0.55 0.16 165)' },
  { id: 'aurora', labelKey: 'theme.aurora', bg: 'oklch(0.11 0.025 195)', accent: '#06b6d4', accentHover: 'oklch(0.62 0.14 195)' },
  { id: 'violet', labelKey: 'theme.violet', bg: 'oklch(0.12 0.03 300)', accent: '#a855f7', accentHover: 'oklch(0.65 0.22 305)' },
  { id: 'rose', labelKey: 'theme.rose', bg: 'oklch(0.14 0.02 350)', accent: '#e11d48', accentHover: 'oklch(0.6 0.22 350)' },
  { id: 'amber', labelKey: 'theme.amber', bg: 'oklch(0.13 0.02 70)', accent: '#f59e0b', accentHover: 'oklch(0.72 0.18 70)' },
];

export const DEFAULT_THEME_ID = 'default';

const LEGACY_THEME_MAP: Record<string, string> = {
  'blue-pink-gradient': DEFAULT_THEME_ID,
  navy: DEFAULT_THEME_ID,
  indigo: DEFAULT_THEME_ID,
  slate: DEFAULT_THEME_ID,
  sky: 'aurora',
  teal: 'emerald',
};

/** Valoare salvată veche; mapează la default sau la o temă existentă */
export function normalizeThemeId(theme: string): string {
  const mapped = LEGACY_THEME_MAP[theme] ?? theme;
  const exists = APP_THEMES.some((t) => t.id === mapped);
  return exists ? mapped : DEFAULT_THEME_ID;
}
