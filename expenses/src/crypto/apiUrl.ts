import { fetchWithFallback, getApiBaseUrl } from '@shared/utils/apiBase';

/** Build an API URL the same way the rest of the app does, including the proxy fallback. */
export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`.replace(/([^:]\/)\/+/g, '$1');
};

export const apiFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetchWithFallback(apiUrl(path), init);
