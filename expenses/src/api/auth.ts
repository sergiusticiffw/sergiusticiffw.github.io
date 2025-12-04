/**
 * Authentication API Service
 * Centralized service for authentication operations
 */

import { createApiClient, API_ENDPOINTS, ApiClient } from '@api/client';
import { LoginPayload, UserData } from '@type/types';

/**
 * Login user with Google OAuth
 */
export async function loginUser(
  loginPayload: LoginPayload
): Promise<{ success: boolean; data?: UserData; error?: Error }> {
  // Create temporary client without token for login
  const apiClient = createApiClient({
    token: '',
    skipAuth: true,
  });

  const response = await apiClient.post<UserData>(
    API_ENDPOINTS.LOGIN,
    loginPayload,
    {
      skipAuth: true, // Login doesn't require auth
    }
  );

  return {
    success: response.success,
    data: response.data || undefined,
    error: response.error || undefined,
  };
}

/**
 * Refresh authentication token
 */
export async function refreshToken(
  apiClient: ApiClient
): Promise<{ success: boolean; token?: string; error?: Error }> {
  const response = await apiClient.get<{ token: string }>(
    API_ENDPOINTS.TOKEN_REFRESH
  );

  return {
    success: response.success,
    token: response.data?.token,
    error: response.error || undefined,
  };
}
