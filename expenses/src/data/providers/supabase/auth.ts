import { getStoredCurrentUser } from '@shared/utils/authStorage';
import type { AuthProvider } from '../../authProvider';
import type { AuthSession, ProviderResult } from '../../types';
import { getSupabaseClient } from './client';
import { profileFromRow } from './mappers';

const isJwt = (token: string) => token.split('.').length === 3;

const oauthRedirectTo = () => {
  const base = window.location.origin;
  // Match Vite base path `/expenses`
  return `${base}/expenses/login`;
};

const sessionFromSupabase = async (
  accessToken: string,
  refreshToken: string | undefined,
  userId: string,
  email?: string | null
): Promise<AuthSession> => {
  const supabase = getSupabaseClient();
  let currency: string | undefined;
  let encryption_status: string | undefined;
  let name = email || undefined;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    const mapped = profileFromRow(profile);
    currency = mapped.currency;
    encryption_status = mapped.encryption_status;
  }

  const normalizedEmail = String(email || name || '')
    .trim()
    .toLowerCase();
  const sessionEmail =
    normalizedEmail.includes('@') ? normalizedEmail : undefined;
  return {
    current_user: {
      uid: userId,
      email: sessionEmail,
      name,
      currency,
      encryption_status,
    },
    access_token: accessToken,
    jwt_token: accessToken,
    refresh_token: refreshToken,
    provider: 'supabase',
  };
};

export function createSupabaseAuthProvider(): AuthProvider {
  return {
    kind: 'supabase',

    async loginWithGoogle(
      googleToken?: string
    ): Promise<ProviderResult<AuthSession | { redirecting: true }>> {
      try {
        const supabase = getSupabaseClient();

        // Real Google ID token (JWT) → native exchange
        if (googleToken && isJwt(googleToken)) {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleToken,
          });

          if (error || !data.session || !data.user) {
            return {
              success: false,
              error: error || new Error('Supabase Google login failed'),
            };
          }

          const session = await sessionFromSupabase(
            data.session.access_token,
            data.session.refresh_token,
            data.user.id,
            data.user.email
          );
          return { success: true, data: session };
        }

        // Access tokens are not valid here (causes "Bad ID token").
        // Use hosted OAuth redirect instead — reliable with Supabase Google provider.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: oauthRedirectTo(),
            queryParams: {
              prompt: 'select_account',
            },
          },
        });

        if (error) {
          return { success: false, error };
        }

        return { success: true, data: { redirecting: true } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async logout(): Promise<void> {
      try {
        await getSupabaseClient().auth.signOut();
      } catch {
        // ignore
      }
    },

    getSession(): AuthSession | null {
      const stored = getStoredCurrentUser() as AuthSession | null;
      if (!stored?.access_token && !(stored as any)?.jwt_token) return null;
      const token = String(
        stored.access_token || (stored as any).jwt_token || ''
      );
      const uid = String(stored.current_user?.uid || '');
      if (!token || !uid) return null;
      const emailRaw = String(
        stored.current_user?.email || stored.current_user?.name || ''
      )
        .trim()
        .toLowerCase();
      return {
        current_user: {
          uid,
          email: emailRaw.includes('@') ? emailRaw : undefined,
          name: stored.current_user?.name,
          currency: stored.current_user?.currency,
          encryption_status: stored.current_user?.encryption_status,
        },
        access_token: token,
        jwt_token: token,
        refresh_token: stored.refresh_token,
        provider: 'supabase',
      };
    },

    async restoreClientSession(): Promise<ProviderResult<AuthSession>> {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          return {
            success: false,
            error: error || new Error('No Supabase session'),
          };
        }
        const session = await sessionFromSupabase(
          data.session.access_token,
          data.session.refresh_token,
          data.session.user.id,
          data.session.user.email
        );
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async refreshSession(): Promise<ProviderResult<AuthSession>> {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session || !data.user) {
          return {
            success: false,
            error: error || new Error('Session refresh failed'),
          };
        }
        const session = await sessionFromSupabase(
          data.session.access_token,
          data.session.refresh_token,
          data.user.id,
          data.user.email
        );
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    onAuthStateChange(callback) {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange(async (_event, sess) => {
        if (!sess?.user) {
          callback(null);
          return;
        }
        const session = await sessionFromSupabase(
          sess.access_token,
          sess.refresh_token,
          sess.user.id,
          sess.user.email
        );
        callback(session);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
