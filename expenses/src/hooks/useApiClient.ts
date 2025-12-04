/**
 * Hook for creating and managing API client instance
 */

import { useMemo } from 'react';
import { createApiClient, ApiClient } from '@api/client';
import { useAuthState } from '@context/context';
import { useNotification } from '@context/notification';
import { useData } from '@context/context';
import { useAuthDispatch } from '@context/context';
import { AuthState } from '@type/types';

/**
 * Hook to get API client instance
 */
export function useApiClient(): ApiClient | null {
  const authState = useAuthState() as AuthState | null;
  const showNotification = useNotification();
  const { dataDispatch } = useData();
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
