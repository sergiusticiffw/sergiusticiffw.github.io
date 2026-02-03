/**
 * Auth only. Data lives in stores (expenseStore, loanStore, settingsStore).
 */
import React, { useEffect } from 'react';
import { useReducer } from 'react';
import { AuthReducer, initialState } from '@shared/context/reducer';
import { AuthState } from '@shared/type/types';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { setupNetworkListener } from '@shared/utils/syncService';
import { logger } from '@shared/utils/logger';
import type { ActionType } from '@shared/type/types';
import { expenseDispatch } from '@stores/expenseStore';
import { hydrateSettings } from '@stores/settingsStore';

const AuthStateContext = React.createContext<AuthState | null>(null);
const AuthDispatchContext =
  React.createContext<React.Dispatch<ActionType> | null>(null);

export const useAuthState = (): AuthState => {
  const context = React.useContext(AuthStateContext);
  if (context === undefined || context === null) {
    throw new Error('useAuthState must be used within AuthProvider');
  }
  return context;
};

export const useAuthDispatch = (): React.Dispatch<ActionType> => {
  const context = React.useContext(AuthDispatchContext);
  if (context === undefined || context === null) {
    throw new Error('useAuthDispatch must be used within AuthProvider');
  }
  return context;
};

function SyncEffect(): null {
  const { token, userIsLoggedIn, currency } = useAuthState();

  useEffect(() => {
    if (!token || !userIsLoggedIn) return;
    if (currency) hydrateSettings({ currency });
    import('@shared/utils/indexedDB').then(
      ({ cleanupInvalidSyncOperations }) => {
        cleanupInvalidSyncOperations().then((count) => {
          if (count > 0)
            logger.log(`Cleaned up ${count} invalid sync operations on mount`);
        });
      }
    );
    const cleanup = setupNetworkListener(token, expenseDispatch);
    return cleanup;
  }, [token, userIsLoggedIn, currency]);

  return null;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, dispatch] = useReducer(AuthReducer, initialState);

  return (
    <GoogleOAuthProvider clientId="14695610160-ui3d8l2qa7tdjfi4s1t46hfl609qcmie.apps.googleusercontent.com">
      <AuthStateContext.Provider value={user}>
        <AuthDispatchContext.Provider value={dispatch}>
          <SyncEffect />
          {children}
        </AuthDispatchContext.Provider>
      </AuthStateContext.Provider>
    </GoogleOAuthProvider>
  );
};
