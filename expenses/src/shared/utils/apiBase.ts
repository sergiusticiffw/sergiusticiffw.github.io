/**
 * API Base URL management with Pantheon → Cloudflare fallback
 * Tries Pantheon first; if inaccessible (DNS, network), uses Cloudflare proxy.
 */

const API_PRIMARY_URL = 'https://dev-expenses-api.pantheonsite.io';
const API_PROXY_URL = 'https://expenses-api-proxy.sergiustici1993.workers.dev';

const FALLBACK_KEY = 'api_use_proxy_fallback';

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

/** Returns true if using proxy (Pantheon inaccessible) */
export function getUseProxyFallback(): boolean {
  try {
    return sessionStorage.getItem(FALLBACK_KEY) === '1';
  } catch {
    return false;
  }
}

/** Set proxy usage (when Pantheon is inaccessible) */
export function setUseProxyFallback(use: boolean): void {
  try {
    if (use) {
      sessionStorage.setItem(FALLBACK_KEY, '1');
    } else {
      sessionStorage.removeItem(FALLBACK_KEY);
    }
  } catch {
    // ignore
  }
}

/** Current API URL (Pantheon or Cloudflare proxy) */
export function getApiBaseUrl(): string {
  return getUseProxyFallback() ? API_PROXY_URL : API_PRIMARY_URL;
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
 * Fetch with fallback: if Pantheon request fails (network), retry with proxy.
 */
export async function fetchWithFallback(
  url: string,
  options?: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (
      isNetworkError(error) &&
      isPrimaryUrl(url) &&
      !getUseProxyFallback()
    ) {
      setUseProxyFallback(true);
      return fetch(toProxyUrl(url), options);
    }
    throw error;
  }
}

export { API_PRIMARY_URL, API_PROXY_URL };
