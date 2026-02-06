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
  { id: 'navy', labelKey: 'theme.navy', bg: 'oklch(0.11 0.02 264)', accent: '#2563eb', accentHover: 'oklch(0.5 0.2 264)' },
  { id: 'teal', labelKey: 'theme.teal', bg: 'oklch(0.12 0.02 180)', accent: '#0d9488', accentHover: 'oklch(0.52 0.12 180)' },
  { id: 'emerald', labelKey: 'theme.emerald', bg: 'oklch(0.12 0.02 165)', accent: '#10b981', accentHover: 'oklch(0.55 0.16 165)' },
  { id: 'slate', labelKey: 'theme.slate', bg: 'oklch(0.14 0.008 260)', accent: '#64748b', accentHover: 'oklch(0.55 0.04 260)' },
  { id: 'indigo', labelKey: 'theme.indigo', bg: 'oklch(0.13 0.025 275)', accent: '#4f46e5', accentHover: 'oklch(0.52 0.22 275)' },
];

export const DEFAULT_THEME_ID = 'default';

/** Valoare salvată veche; mapează la default sau la o temă existentă */
export function normalizeThemeId(theme: string): string {
  if (theme === 'blue-pink-gradient') return DEFAULT_THEME_ID;
  const exists = APP_THEMES.some((t) => t.id === theme);
  return exists ? theme : DEFAULT_THEME_ID;
}
