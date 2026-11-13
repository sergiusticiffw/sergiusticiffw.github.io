/**
 * Runtime data-provider preference (Drupal | Supabase) — per browser / user.
 * Kept free of provider imports so IndexedDB and factory can both use it.
 */
import type { DataProviderKind } from './types';

export const DATA_PROVIDER_PREF_KEY = 'expenses.dataProvider';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseDataProviderKind = (
  raw: unknown
): DataProviderKind | null => {
  if (raw === 'supabase' || raw === 'drupal') return raw;
  if (typeof raw === 'string') {
    const v = raw.toLowerCase().trim();
    if (v === 'supabase' || v === 'drupal') return v;
  }
  return null;
};

/**
 * Build-time default when the user has no stored preference.
 * Classic (Drupal) is always the default selection for new / anonymous users.
 */
export const envDefaultDataProviderKind = (): DataProviderKind => 'drupal';

const readSessionProvider = (): DataProviderKind | null => {
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      provider?: unknown;
      current_user?: { uid?: unknown };
    };
    const fromField = parseDataProviderKind(parsed?.provider);
    if (fromField) return fromField;

    // Legacy sessions without `provider`: UUID uid ⇒ Supabase.
    const uid = String(parsed?.current_user?.uid ?? '');
    if (UUID_RE.test(uid)) return 'supabase';
  } catch {
    // ignore
  }
  return null;
};

const readPrefProvider = (): DataProviderKind | null => {
  try {
    return parseDataProviderKind(localStorage.getItem(DATA_PROVIDER_PREF_KEY));
  } catch {
    return null;
  }
};

/** Preference only (survives logout). Does not fall back to env. */
export const getPreferredDataProviderKind = (): DataProviderKind | null =>
  readPrefProvider();

/**
 * Active kind: logged-in session → saved preference → env default.
 */
export const resolveDataProviderKind = (): DataProviderKind =>
  readSessionProvider() || readPrefProvider() || envDefaultDataProviderKind();

/** Persist choice for next login / OAuth return. */
export const setPreferredDataProviderKind = (kind: DataProviderKind): void => {
  localStorage.setItem(DATA_PROVIDER_PREF_KEY, kind);
};
