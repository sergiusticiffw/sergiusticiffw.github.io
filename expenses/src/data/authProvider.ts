import type { AuthSession, ProviderResult } from './types';

export interface AuthProvider {
  readonly kind: AuthSession['provider'];

  /**
   * Exchange a Google token for an app session.
   * - Drupal: Google OAuth access_token (required).
   * - Supabase: Google ID token JWT, or omit to start OAuth redirect.
   */
  loginWithGoogle(
    googleToken?: string
  ): Promise<ProviderResult<AuthSession | { redirecting: true }>>;

  logout(): Promise<void>;

  getSession(): AuthSession | null;

  /** Refresh or validate the current session token. */
  refreshSession(): Promise<ProviderResult<AuthSession>>;

  /** Load session from the provider client (e.g. after OAuth redirect). */
  restoreClientSession?(): Promise<ProviderResult<AuthSession>>;

  /**
   * Optional live auth listener (Supabase). Returns unsubscribe.
   * Drupal adapter may no-op.
   */
  onAuthStateChange?(
    callback: (session: AuthSession | null) => void
  ): () => void;
}
