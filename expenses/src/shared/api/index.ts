/**
 * Shared API: client and auth. Feature APIs live under features/<name>/api.
 */
export { createApiClient, ApiClient, API_ENDPOINTS } from './client';
export type { ApiClientConfig, ApiRequestOptions, ApiResponse } from './client';
export * from './auth';
