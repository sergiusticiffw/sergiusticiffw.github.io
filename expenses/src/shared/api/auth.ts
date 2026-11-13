/**
 * Authentication API Service — delegates to the active AuthProvider.
 */

import { LoginPayload } from '@shared/type/types';
import { getAuthProvider, getDataProviderKind } from '../../data';
import type { AuthSession } from '../../data';

/**
 * Login user with Google OAuth
 */
export async function loginUser(
  loginPayload: LoginPayload = {}
): Promise<{
  success: boolean;
  data?: AuthSession | { redirecting: true };
  error?: Error;
}> {
  const kind = getDataProviderKind();
  if (kind === 'supabase') {
    const idToken =
      loginPayload.id_token && loginPayload.id_token.split('.').length === 3
        ? loginPayload.id_token
        : undefined;
    return getAuthProvider().loginWithGoogle(idToken);
  }

  const token = loginPayload.access_token || loginPayload.id_token;
  if (!token) {
    return { success: false, error: new Error('Missing Google token') };
  }

  return getAuthProvider().loginWithGoogle(token);
}

/**
 * Refresh authentication session
 */
export async function refreshToken(): Promise<{
  success: boolean;
  token?: string;
  error?: Error;
}> {
  const result = await getAuthProvider().refreshSession();
  return {
    success: result.success,
    token: result.data?.access_token,
    error: result.error,
  };
}
