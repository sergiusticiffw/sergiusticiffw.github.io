/**
 * API Module - Centralized API access
 *
 * This module provides a unified API client and service functions
 * for all API operations in the application.
 */

export { createApiClient, ApiClient, API_ENDPOINTS } from './client';
export type { ApiClientConfig, ApiRequestOptions, ApiResponse } from './client';

// Services
export * from './expenses';
export * from './loans';
export * from './auth';
