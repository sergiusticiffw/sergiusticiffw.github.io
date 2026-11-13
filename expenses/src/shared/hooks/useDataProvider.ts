/**
 * Hook that configures and returns the active DataProvider for the session.
 */

import { useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthState, useAuthDispatch } from '@shared/context/context';
import { useNotification } from '@shared/context/notification';
import { useExpenseData } from '@stores/expenseStore';
import { logout } from '@shared/context/actions';
import { getDataProvider, type DataProvider } from '../../data';

/**
 * Returns the configured DataProvider, or null when the user has no token.
 */
export function useDataProvider(): DataProvider | null {
  const authState = useAuthState();
  const showNotification = useNotification();
  const { dataDispatch } = useExpenseData();
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
  const expiringRef = useRef(false);

  const dataProvider = useMemo(() => {
    if (!authState?.token) {
      return null;
    }

    const provider = getDataProvider();
    provider.configure(authState.token, {
      showNotification,
      dataDispatch,
      dispatch,
      onSessionExpired: () => {
        if (expiringRef.current) return;
        expiringRef.current = true;
        void logout(dispatch, dataDispatch).finally(() => {
          navigate({ to: '/expenses/login' });
          expiringRef.current = false;
        });
      },
    });
    return provider;
  }, [authState?.token, showNotification, dataDispatch, dispatch, navigate]);

  return dataProvider;
}

/** @deprecated Prefer useDataProvider — kept for gradual migration. */
export function useApiClient(): DataProvider | null {
  return useDataProvider();
}
