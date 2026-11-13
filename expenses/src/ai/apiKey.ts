import { getDataProvider } from '../data';

export const maskApiKey = (key: string) =>
  key.length > 8 ? `${key.slice(0, 4)}••••••••${key.slice(-4)}` : '••••••••';

let serverKeyRequest: Promise<string> | null = null;

/** Reads the key from the user profile via the active DataProvider. */
export const fetchApiKeyFromServer = (
  uid: number | string,
  token: string
): Promise<string> => {
  if (!serverKeyRequest) {
    serverKeyRequest = (async () => {
      const provider = getDataProvider();
      provider.configure(token);
      const result = await provider.getProfile(String(uid));
      if (!result.success || !result.data) throw new Error('profile failed');
      return (result.data.gemini_api_key || '').trim();
    })().finally(() => {
      serverKeyRequest = null;
    });
  }
  return serverKeyRequest;
};

export type ApiKeySync = 'synced' | 'local';

/**
 * Writes the key to the profile. If the request fails, the caller keeps
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
