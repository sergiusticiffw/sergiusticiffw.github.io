/**
 * API Base URL management with Pantheon → Cloudflare fallback
 * Tries Pantheon first; if inaccessible (DNS, network), uses Cloudflare proxy.
 */

const API_PRIMARY_URL = 'https://dev-expenses-api.pantheonsite.io';
const API_PROXY_URL = 'https://expenses-api-proxy.sergiustici1993.workers.dev';

/** Check if error is a network error (DNS, timeout, connection) */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return (
      error.message === 'Failed to fetch' ||
      error.message.includes('NetworkError') ||
      error.message.includes('Load failed')
    );
  }
  if (error instanceof Error) {
    return (
      error.message.includes('ERR_NAME_NOT_RESOLVED') ||
      error.message.includes('ERR_CONNECTION_REFUSED') ||
      error.message.includes('ERR_NETWORK') ||
      error.message.includes('Failed to fetch')
    );
  }
  return false;
}

/** Pantheon. The Cloudflare proxy is only a one-off retry inside fetchWithFallback. */
export function getApiBaseUrl(): string {
  return API_PRIMARY_URL;
}

/** Convert URL from primary to proxy (for retry) */
export function toProxyUrl(url: string): string {
  if (url.startsWith(API_PRIMARY_URL)) {
    return url.replace(API_PRIMARY_URL, API_PROXY_URL);
  }
  return url;
}

/** Check if URL uses primary (Pantheon) */
export function isPrimaryUrl(url: string): boolean {
  return url.startsWith(API_PRIMARY_URL);
}

/**
 * Always call Pantheon. Use the Cloudflare proxy only when that request fails
 * before a response (DNS, connection). The next request starts on Pantheon again.
 */
export async function fetchWithFallback(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (!isNetworkError(error) || !isPrimaryUrl(url)) throw error;
    const proxyUrl = toProxyUrl(url);
    if (proxyUrl === url) throw error;
    return fetch(proxyUrl, options);
  }
}

export { API_PRIMARY_URL, API_PROXY_URL };
