import { getDataProvider, getDataProviderKind } from '../data';

export const maskApiKey = (key: string) =>
  key.length > 8 ? `${key.slice(0, 4)}••••••••${key.slice(-4)}` : '••••••••';

export type ApiKeySync = 'synced' | 'local';

let geminiServerKeyRequest: Promise<string> | null = null;
let openrouterServerKeyRequest: Promise<string> | null = null;

/** Reads the Gemini key from the user profile via the active DataProvider. */
export const fetchApiKeyFromServer = (
  uid: number | string,
  token: string
): Promise<string> => {
  if (!geminiServerKeyRequest) {
    geminiServerKeyRequest = (async () => {
      const provider = getDataProvider();
      provider.configure(token);
      const result = await provider.getProfile(String(uid));
      if (!result.success || !result.data) throw new Error('profile failed');
      return (result.data.gemini_api_key || '').trim();
    })().finally(() => {
      geminiServerKeyRequest = null;
    });
  }
  return geminiServerKeyRequest;
};

/**
 * Writes the Gemini key to the profile. If the request fails, the caller keeps
 * the local copy and reports that it did not sync.
 */
export const saveApiKeyToServer = async (
  uid: number | string,
  token: string,
  key: string
): Promise<ApiKeySync> => {
  if (!uid || !token) return 'local';
  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.updateProfile(String(uid), {
      gemini_api_key: key || null,
    });
    if (!result.success) return 'local';
    if (key && !result.data?.gemini_api_key) return 'local';
    return 'synced';
  } catch {
    return 'local';
  }
};

/**
 * Reads the OpenRouter key from the profile (Supabase column).
 * Also migrates a legacy value from preferences.openrouterApiKey once.
 */
export const fetchOpenrouterApiKeyFromServer = (
  uid: number | string,
  token: string
): Promise<string> => {
  if (!openrouterServerKeyRequest) {
    openrouterServerKeyRequest = (async () => {
      const provider = getDataProvider();
      provider.configure(token);
      const result = await provider.getProfile(String(uid));
      if (!result.success || !result.data) throw new Error('profile failed');

      const column = (result.data.openrouter_api_key || '').trim();
      if (column) return column;

      // One-time migrate from older preferences blob (pre-column).
      const prefs = result.data.preferences as
        | { openrouterApiKey?: string }
        | undefined;
      const legacy =
        typeof prefs?.openrouterApiKey === 'string'
          ? prefs.openrouterApiKey.trim()
          : '';
      if (!legacy) return '';

      if (getDataProviderKind() === 'supabase') {
        await provider.updateProfile(String(uid), {
          openrouter_api_key: legacy,
        });
      }
      return legacy;
    })().finally(() => {
      openrouterServerKeyRequest = null;
    });
  }
  return openrouterServerKeyRequest;
};

/**
 * Writes the OpenRouter key to profiles.openrouter_api_key (Supabase).
 * Drupal has no field — stays local only.
 */
export const saveOpenrouterApiKeyToServer = async (
  uid: number | string,
  token: string,
  key: string
): Promise<ApiKeySync> => {
  if (!uid || !token) return 'local';
  if (getDataProviderKind() !== 'supabase') return 'local';
  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.updateProfile(String(uid), {
      openrouter_api_key: key || null,
    });
    if (!result.success) return 'local';
    if (key && !result.data?.openrouter_api_key) return 'local';
    return 'synced';
  } catch {
    return 'local';
  }
};
