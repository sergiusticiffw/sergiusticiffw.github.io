import { LoginPayload, UserData } from '@shared/type/types';
import { clearExpensesDB } from '@shared/utils/indexedDB';
import { buildApiUrl } from '@shared/utils/utils';
import { hydrateSettings } from '@stores/settingsStore';
import { clearChatSession } from '../../ai/chatSession';
import { clearAiLocalData } from '../../ai/storage';
import {
  applyLoginStatus,
  resetEncryptionState,
} from '../../crypto/encryptionState';
import { resetTagsOnLogout } from '../../tags/catalog';
import { clearUnlockOnLogout, markUnlocked } from '../../features/privacy/biometricLock';
import { getStoredCurrentUser } from '@shared/utils/authStorage';

export const loginUser = async (dispatch: any, loginPayload: LoginPayload) => {
  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginPayload),
  };

  try {
    dispatch({ type: 'REQUEST_LOGIN' });
    const response = await fetch(
      buildApiUrl('/user/login/google?_format=json'),
      requestOptions
    );
    const data: UserData = await response.json();

    if (data.current_user) {
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      localStorage.setItem('currentUser', JSON.stringify(data));
      applyLoginStatus(
        (data.current_user as { encryption_status?: string })?.encryption_status
      );
      const currency = (data.current_user as { currency?: string })?.currency;
      if (currency) hydrateSettings({ currency });
      const uid = String(
        (data.current_user as { uid?: string | number }).uid ?? ''
      );
      if (uid) markUnlocked(uid);
      return data;
    }

    dispatch({ type: 'LOGIN_ERROR', error: data.errors[0] });
  } catch (error) {
    dispatch({ type: 'LOGIN_ERROR', error: error });
  }
};

export const logout = async (dispatch: any, dataDispatch: any) => {
  const stored = getStoredCurrentUser();
  const uid = String(
    (stored?.current_user as { uid?: string | number } | undefined)?.uid ?? ''
  );
  if (uid) clearUnlockOnLogout(uid);

  await dispatch({ type: 'LOGOUT' });
  await dataDispatch({ type: 'REMOVE_DATA' });
  resetEncryptionState();
  resetTagsOnLogout();
  localStorage.removeItem('currentUser');
  localStorage.removeItem('token');
  clearChatSession();
  clearAiLocalData();
  // Clear IndexedDB cache on logout
  await clearExpensesDB();
};
