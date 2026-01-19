import React, { useReducer, useEffect } from 'react';
import {
  AuthReducer,
  DataReducer,
  initialData,
  initialState,
} from '@context/reducer';
import { AuthState, DataItems, DataState } from '@type/types';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { setupNetworkListener } from '@utils/syncService';
import { logger } from '@utils/logger';

const AuthStateContext = React.createContext<AuthState | null>(null);
const AuthDispatchContext = React.createContext<React.Dispatch<any> | null>(
  null
);
export const DataContext = React.createContext<DataState>({
  data: { ...initialData },
  dataDispatch: () => {},
});

export const useAuthState = () => {
  const context = React.useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within a AuthProvider');
  }

  return context;
};

export const useData = () => {
  const context = React.useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a AuthProvider');
  }

  return context;
};

export const useAuthDispatch = () => {
  const context = React.useContext(AuthDispatchContext);
  if (context === undefined) {
    throw new Error('useAuthDispatch must be used within a AuthProvider');
  }

  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, dispatch] = useReducer(AuthReducer, initialState);
  const [data, dataDispatch] = useReducer(
    DataReducer,
    initialData as DataItems
  );

  // Setup offline sync when user is logged in
  useEffect(() => {
    if (user.token && user.userIsLoggedIn) {
      // Clean up invalid operations on mount
      import('@utils/indexedDB').then(({ cleanupInvalidSyncOperations }) => {
        cleanupInvalidSyncOperations().then((count) => {
          if (count > 0) {
            logger.log(`Cleaned up ${count} invalid sync operations on mount`);
          }
        });
      });

      const cleanup = setupNetworkListener(user.token, dataDispatch);
      return cleanup;
    }
  }, [user.token, user.userIsLoggedIn, dataDispatch]);

  return (
    <GoogleOAuthProvider clientId="14695610160-ui3d8l2qa7tdjfi4s1t46hfl609qcmie.apps.googleusercontent.com">
      <AuthStateContext.Provider value={user}>
        <AuthDispatchContext.Provider value={dispatch}>
          <DataContext.Provider value={{ data, dataDispatch }}>
            {children}
          </DataContext.Provider>
        </AuthDispatchContext.Provider>
      </AuthStateContext.Provider>
    </GoogleOAuthProvider>
  );
};
