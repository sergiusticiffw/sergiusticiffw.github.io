/**
 * Centralized API Client
 * Provides a unified interface for all API calls with:
 * - Authentication handling
 * - Retry logic with exponential backoff
 * - Error handling and user notifications
 * - Offline support
 * - Type safety
 */

import { API_BASE_URL } from '@shared/utils/utils';
import { retryWithBackoff, retryPresets } from '@shared/utils/retry';
import { logger } from '@shared/utils/logger';
import { isOnline } from '@shared/utils/indexedDB';
import { logout } from '@shared/context/actions';

export interface ApiClientConfig {
  token: string;
  skipAuth?: boolean;
  showNotification?: (
    message: string,
    type: string,
    options?: { groupId?: string; duration?: number }
  ) => void;
  dataDispatch?: (action: any) => void;
  dispatch?: (action: any) => void;
  retryConfig?: typeof retryPresets.standard;
}

export interface ApiRequestOptions extends RequestInit {
  skipRetry?: boolean;
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

/**
 * Centralized API Client Class
 */
class ApiClient {
  private token: string;
  private skipAuth?: boolean;
  private showNotification?: (
    message: string,
    type: string,
    options?: { groupId?: string; duration?: number }
  ) => void;
  private dataDispatch?: (action: any) => void;
  private dispatch?: (action: any) => void;
  private retryConfig: typeof retryPresets.standard;

  constructor(config: ApiClientConfig) {
    this.token = config.token;
    this.skipAuth = config.skipAuth;
    this.showNotification = config.showNotification;
    this.dataDispatch = config.dataDispatch;
    this.dispatch = config.dispatch;
    this.retryConfig = config.retryConfig || retryPresets.standard;
  }

  /**
   * Create authenticated headers
   */
  private createHeaders(skipAuth: boolean = false): Headers {
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });

    if (!skipAuth && this.token) {
      headers.set('JWT-Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  /**
   * Handle API errors
   */
  private async handleErrorResponse(
    response: Response,
    url: string
  ): Promise<never> {
    // Handle 403 - Unauthorized
    if (response.status === 403) {
      logger.error('API request unauthorized (403)');

      // Try to refresh token or logout
      if (this.dispatch && this.dataDispatch) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/jwt/token`, {
            method: 'GET',
            headers: this.createHeaders(),
          });

          if (refreshResponse.status === 403) {
            logout(this.dispatch, this.dataDispatch);
            // Use groupId to replace previous session expired errors
            if (this.showNotification) {
              this.showNotification(
                'Session expired. Please log in again.',
                'error',
                { groupId: 'session-expired', duration: 10000 } // Auto-dismiss after 10 seconds
              );
            }
            throw new Error('Session expired. Please log in again.');
          }
        } catch (error) {
          if (this.dispatch && this.dataDispatch) {
            logout(this.dispatch, this.dataDispatch);
          }
          // Use groupId to replace previous session expired errors
          if (this.showNotification) {
            this.showNotification(
              'Session expired. Please log in again.',
              'error',
              { groupId: 'session-expired', duration: 10000 } // Auto-dismiss after 10 seconds
            );
          }
          throw new Error('Session expired. Please log in again.');
        }
      }
    }

    // Handle other errors
    const errorText = await response.text().catch(() => response.statusText);
    const errorMessage = errorText || `HTTP error! status: ${response.status}`;

    throw new Error(errorMessage);
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // Handle empty responses
    if (contentLength === '0' || !contentType) {
      return null;
    }

    // Handle JSON responses
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      if (!text || text.trim() === '') {
        return null;
      }
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        logger.warn('Failed to parse JSON response:', error);
        throw new Error('Failed to parse server response');
      }
    }

    // Handle text responses
    return (await response.text()) as unknown as T;
  }

  /**
   * Make API request with retry logic
   */
  async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { skipRetry = false, skipAuth = false, ...fetchOptions } = options;

    // Check if online
    if (!isOnline()) {
      const error = new Error('No internet connection');
      // Don't spam global error notifications here; offline-first flows
      // handle their own UX and we already have an offline indicator.
      return {
        data: null,
        error,
        success: false,
      };
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;

    const headers = this.createHeaders(skipAuth);

    // Merge custom headers
    if (fetchOptions.headers) {
      if (fetchOptions.headers instanceof Headers) {
        fetchOptions.headers.forEach((value, key) => {
          headers.set(key, value);
        });
      } else {
        Object.entries(fetchOptions.headers).forEach(([key, value]) => {
          headers.set(key, String(value));
        });
      }
    }

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    try {
      let response: Response;

      if (skipRetry) {
        // Direct fetch without retry
        response = await fetch(url, requestOptions);
      } else {
        // Use retry logic
        const retryResult = await retryWithBackoff(
          async () => {
            const res = await fetch(url, requestOptions);
            if (!res.ok) {
              await this.handleErrorResponse(res, url);
            }
            return res;
          },
          {
            ...this.retryConfig,
            onRetry: (attempt, error) => {
              logger.warn(
                `Retrying API request to ${endpoint} (attempt ${attempt}):`,
                error
              );
            },
          }
        );

        if (!retryResult.success) {
          const error =
            retryResult.error instanceof Error
              ? retryResult.error
              : new Error('Request failed after retries');

          if (this.showNotification) {
            const errorMessage =
              error.message || 'Network error. Please try again.';
            this.showNotification(errorMessage, 'error');
          }

          return {
            data: null,
            error,
            success: false,
          };
        }

        response = retryResult.data!;
      }

      // Parse response
      const data = await this.parseResponse<T>(response);

      return {
        data,
        error: null,
        success: true,
      };
    } catch (error) {
      const apiError =
        error instanceof Error
          ? error
          : new Error('An unexpected error occurred');

      logger.error(`API request failed for ${endpoint}:`, apiError);

      if (this.showNotification) {
        const errorMessage =
          apiError.message || 'An error occurred. Please try again.';
        this.showNotification(errorMessage, 'error');
      }

      return {
        data: null,
        error: apiError,
        success: false,
      };
    }
  }

  /**
   * GET request
   */
  async get<T = any>(
    endpoint: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    endpoint: string,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Update token
   */
  updateToken(token: string): void {
    this.token = token;
  }

  /**
   * Update notification handler
   */
  updateNotificationHandler(
    handler: (message: string, type: string) => void
  ): void {
    this.showNotification = handler;
  }
}

/**
 * Create API client instance
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

/**
 * API endpoints constants
 */
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/user/login/google?_format=json',
  TOKEN_REFRESH: '/jwt/token',

  // Expenses & Income
  EXPENSES: '/api/expenses',
  EXPENSE: (id: string) => `/node/${id}?_format=json`,
  CREATE_NODE: '/node?_format=json',

  // Loans
  LOANS: '/api/loans',
  LOAN: (id: string) => `/node/${id}?_format=json`,
  LOAN_PAYMENTS: (loanId: string) => `/api/payments/${loanId}`,
} as const;

export { ApiClient };
export default ApiClient;
