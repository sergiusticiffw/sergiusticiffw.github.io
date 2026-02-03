/**
 * Hook for creating and managing API client instance
 */

import { useMemo } from 'react';
import { createApiClient, ApiClient } from '@shared/api/client';
import { useAuthState, useAuthDispatch } from '@shared/context/context';
import { useNotification } from '@shared/context/notification';
import { useExpenseData } from '@stores/expenseStore';

/**
 * Hook to get API client instance
 */
export function useApiClient(): ApiClient | null {
  const authState = useAuthState();
  const showNotification = useNotification();
  const { dataDispatch } = useExpenseData();
  const dispatch = useAuthDispatch();

  const apiClient = useMemo(() => {
    if (!authState?.token) {
      return null;
    }

    return createApiClient({
      token: authState.token,
      showNotification,
      dataDispatch,
      dispatch,
    });
  }, [authState?.token, showNotification, dataDispatch, dispatch]);

  return apiClient;
}
