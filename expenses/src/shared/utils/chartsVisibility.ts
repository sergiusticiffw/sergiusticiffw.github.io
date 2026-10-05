import { availableCharts, defaultVisibleCharts } from './constants';

const VISIBLE_CHARTS_KEY = 'visibleCharts';
const CUSTOM_CHARTS_KEY = 'customChartsEnabled';

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v != null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function readCustomChartsEnabled(): boolean {
  return readJson(CUSTOM_CHARTS_KEY, false) === true;
}

export function writeCustomChartsEnabled(value: boolean): void {
  localStorage.setItem(CUSTOM_CHARTS_KEY, JSON.stringify(value));
}

export function readStoredVisibleCharts(): string[] {
  const stored = readJson<unknown>(VISIBLE_CHARTS_KEY, null);
  if (!Array.isArray(stored)) return [...defaultVisibleCharts];
  return stored.filter(
    (c): c is string => typeof c === 'string' && availableCharts.includes(c)
  );
}

export function writeStoredVisibleCharts(value: string[]): void {
  localStorage.setItem(VISIBLE_CHARTS_KEY, JSON.stringify(value));
}

export function getEffectiveVisibleCharts(): string[] {
  return readCustomChartsEnabled()
    ? readStoredVisibleCharts()
    : [...defaultVisibleCharts];
}
