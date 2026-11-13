import { LoginPayload } from '@shared/type/types';
import { clearExpensesDB } from '@shared/utils/indexedDB';
import { hydrateSettings } from '@stores/settingsStore';
import { clearChatSession } from '../../ai/chatSession';
import { clearAiLocalData } from '../../ai/storage';
import {
  applyLoginStatus,
  resetEncryptionState,
} from '../../crypto/encryptionState';
import { resetTagsOnLogout } from '../../tags/catalog';
import {
  clearUnlockOnLogout,
  markUnlocked,
} from '../../features/privacy/biometricLock';
import { hydrateEmergencyFund } from '../../features/goals/store';
import { getStoredCurrentUser } from '@shared/utils/authStorage';
import {
  getAuthProvider,
  getDataProviderKind,
  resetProviders,
  setDataProviderKind,
} from '../../data';
import type { AuthSession } from '../../data';

const persistSession = (dispatch: any, data: AuthSession) => {
  const kind = data.provider || getDataProviderKind();
  setDataProviderKind(kind);
  const stored = {
    ...data,
    provider: kind,
    jwt_token: data.access_token,
    access_token: data.access_token,
  };
  dispatch({ type: 'LOGIN_SUCCESS', payload: stored });
  localStorage.setItem('currentUser', JSON.stringify(stored));
  applyLoginStatus(data.current_user.encryption_status);
  if (data.current_user.currency) {
    hydrateSettings({ currency: data.current_user.currency });
  }
  hydrateEmergencyFund();
  const uid = String(data.current_user.uid ?? '');
  if (uid) markUnlocked(uid);
  return stored;
};

export const loginUser = async (dispatch: any, loginPayload: LoginPayload) => {
  try {
    dispatch({ type: 'REQUEST_LOGIN' });
    const auth = getAuthProvider();
    const kind = getDataProviderKind();

    if (kind === 'supabase') {
      // Prefer a real ID token JWT; otherwise start OAuth redirect (never send access_token).
      const idToken =
        loginPayload.id_token && loginPayload.id_token.split('.').length === 3
          ? loginPayload.id_token
          : undefined;
      const result = await auth.loginWithGoogle(idToken);
      if (!result.success) {
        dispatch({
          type: 'LOGIN_ERROR',
          error: result.error?.message || 'Login failed',
        });
        return;
      }
      if (
        result.data &&
        'redirecting' in result.data &&
        result.data.redirecting
      ) {
        // Browser navigates to Google / Supabase; session restored on return.
        return { redirecting: true };
      }
      if (!result.data || !('current_user' in result.data)) {
        dispatch({ type: 'LOGIN_ERROR', error: 'Login failed' });
        return;
      }
      return persistSession(dispatch, result.data as AuthSession);
    }

    const googleToken =
      loginPayload.access_token || loginPayload.id_token;
    if (!googleToken) {
      dispatch({ type: 'LOGIN_ERROR', error: 'Missing Google token' });
      return;
    }

    const result = await auth.loginWithGoogle(googleToken);
    if (!result.success || !result.data || !('current_user' in result.data)) {
      dispatch({
        type: 'LOGIN_ERROR',
        error: result.error?.message || 'Login failed',
      });
      return;
    }

    return persistSession(dispatch, result.data as AuthSession);
  } catch (error) {
    dispatch({ type: 'LOGIN_ERROR', error: error });
  }
};

/** After Supabase OAuth redirect, pull the client session into app state. */
export const restoreSupabaseSession = async (dispatch: any) => {
  const auth = getAuthProvider();
  if (auth.kind !== 'supabase' || !auth.restoreClientSession) return null;
  const result = await auth.restoreClientSession();
  if (!result.success || !result.data) return null;
  return persistSession(dispatch, result.data);
};

export const logout = async (dispatch: any, dataDispatch: any) => {
  const stored = getStoredCurrentUser();
  const uid = String(
    (stored?.current_user as { uid?: string | number } | undefined)?.uid ?? ''
  );
  if (uid) clearUnlockOnLogout(uid);

  try {
    await getAuthProvider().logout();
  } catch {
    // ignore provider logout errors
  }

  await dispatch({ type: 'LOGOUT' });
  await dataDispatch({ type: 'REMOVE_DATA' });
  resetEncryptionState();
  resetTagsOnLogout();
  localStorage.removeItem('currentUser');
  localStorage.removeItem('token');
  // Keep expenses.dataProvider preference so next login uses the same backend.
  resetProviders();
  clearChatSession();
  clearAiLocalData();
  await clearExpensesDB();
};
