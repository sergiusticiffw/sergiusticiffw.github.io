/**
 * Hook that configures and returns the active DataProvider for the session.
 */

import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthState, useAuthDispatch } from '@shared/context/context';
import { useNotification } from '@shared/context/notification';
import { useExpenseData } from '@stores/expenseStore';
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

  const dataProvider = useMemo(() => {
    if (!authState?.token) {
      return null;
    }

    const provider = getDataProvider();
    provider.configure(authState.token, {
      showNotification,
      dataDispatch,
      dispatch,
      onSessionExpired: () => navigate({ to: '/expenses/login' }),
    });
    return provider;
  }, [authState?.token, showNotification, dataDispatch, dispatch, navigate]);

  return dataProvider;
}

/** @deprecated Prefer useDataProvider — kept for gradual migration. */
export function useApiClient(): DataProvider | null {
  return useDataProvider();
}
