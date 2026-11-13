import { createApiClient, API_ENDPOINTS } from '@shared/api/client';
import { getStoredCurrentUser } from '@shared/utils/authStorage';
import type { AuthProvider } from '../../authProvider';
import type { AuthSession, ProviderResult } from '../../types';

const toSession = (data: any): AuthSession | null => {
  if (!data?.current_user) return null;
  const token = String(data.jwt_token || data.access_token || '');
  if (!token) return null;
  const uid = String(
    data.current_user.uid ?? data.current_user?.uid?.[0]?.value ?? ''
  );
  return {
    current_user: {
      uid,
      name: data.current_user.name,
      currency: data.current_user.currency,
      encryption_status: data.current_user.encryption_status,
    },
    access_token: token,
    jwt_token: token,
    provider: 'drupal',
  };
};

export function createDrupalAuthProvider(): AuthProvider {
  return {
    kind: 'drupal',

    async loginWithGoogle(
      googleAccessToken?: string
    ): Promise<ProviderResult<AuthSession>> {
      if (!googleAccessToken) {
        return {
          success: false,
          error: new Error('Missing Google access token'),
        };
      }
      const apiClient = createApiClient({ token: '', skipAuth: true });
      const response = await apiClient.post(
        API_ENDPOINTS.LOGIN,
        { access_token: googleAccessToken },
        { skipAuth: true }
      );
      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || new Error('Login failed'),
        };
      }
      const session = toSession(response.data);
      if (!session) {
        const errors = (response.data as any)?.errors;
        return {
          success: false,
          error: new Error(errors?.[0] || 'Login failed'),
        };
      }
      return { success: true, data: session };
    },

    async logout(): Promise<void> {
      // Session cleared by app logout action.
    },

    getSession(): AuthSession | null {
      const stored = getStoredCurrentUser();
      if (!stored) return null;
      return toSession(stored);
    },

    async refreshSession(): Promise<ProviderResult<AuthSession>> {
      const current = this.getSession();
      if (!current) {
        return { success: false, error: new Error('No session') };
      }
      const apiClient = createApiClient({ token: current.access_token });
      const response = await apiClient.get(API_ENDPOINTS.TOKEN_REFRESH);
      if (!response.success) {
        return {
          success: false,
          error: response.error || new Error('Token refresh failed'),
        };
      }
      // Drupal /jwt/token validates; token usually unchanged.
      return { success: true, data: current };
    },
  };
}
