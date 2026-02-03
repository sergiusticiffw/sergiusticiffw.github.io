/**
 * Expenses API Service
 * Centralized service for expense-related API operations
 */

import { ApiClient, API_ENDPOINTS } from '@shared/api/client';
import { TransactionOrIncomeItem } from '@shared/type/types';
import {
  getExpensesFromDB,
  saveExpensesToDB,
  isIndexedDBAvailable,
} from '@shared/utils/indexedDB';
import { processDataWithWorker, processDataSync } from '@shared/utils/utils';

export interface FetchExpensesOptions {
  category?: string;
  textFilter?: string;
  showNotification?: (message: string, type: string) => void;
}

// Prevent duplicate parallel fetches (e.g. React StrictMode double-effects in dev)
let expensesFetchInFlight: Promise<void> | null = null;

/**
 * Fetch expenses with offline-first approach
 */
export async function fetchExpenses(
  apiClient: ApiClient,
  dataDispatch: (action: any) => void,
  options: FetchExpensesOptions = {}
): Promise<void> {
  if (expensesFetchInFlight) {
    return expensesFetchInFlight;
  }

  expensesFetchInFlight = (async () => {
    const { category = '', textFilter = '' } = options;

    // Try to load from IndexedDB first for instant display
    if (isIndexedDBAvailable()) {
      const cachedData = await getExpensesFromDB();
      if (cachedData && cachedData.length > 0) {
        // Sort cached data
        const sortedCachedData = [...cachedData].sort((a, b) => {
          const dateA = new Date(a.dt).getTime();
          const dateB = new Date(b.dt).getTime();
          const dateComparison = dateB - dateA;

          if (dateComparison !== 0) {
            return dateComparison;
          }

          const crA = a.cr || new Date(a.dt).getTime();
          const crB = b.cr || new Date(b.dt).getTime();
          return crB - crA;
        });

        // Process cached data with worker
        processDataWithWorker(sortedCachedData, (processedData) => {
          dataDispatch({
            type: 'SET_DATA',
            raw: sortedCachedData,
            ...processedData,
            totals: processedData.monthsTotals,
            loading: false,
          });

          if (category || textFilter) {
            dataDispatch({
              type: 'FILTER_DATA',
              category,
              textFilter,
            });
          }
        });
      }
    }

    // Fetch fresh data from API (when offline, get() returns success: false immediately)
    const response = await apiClient.get<TransactionOrIncomeItem[]>(
      API_ENDPOINTS.EXPENSES,
      {
        skipRetry: false, // Use retry for expenses
      }
    );

    if (!response.success || !response.data) {
      // Offline or network error: ensure UI shows cached data and loading is false
      if (isIndexedDBAvailable()) {
        const cachedData = await getExpensesFromDB();
        if (cachedData && cachedData.length > 0) {
          const processedData = processDataSync(cachedData);
          dataDispatch({
            type: 'SET_DATA',
            raw: cachedData,
            ...processedData,
            totals: processedData.monthsTotals,
            loading: false,
          });
          if (category || textFilter) {
            dataDispatch({
              type: 'FILTER_DATA',
              category,
              textFilter,
            });
          }
        } else {
          dataDispatch({ type: 'SET_DATA', raw: [], loading: false });
        }
      } else {
        dataDispatch({ type: 'SET_DATA', raw: [], loading: false });
      }
      return;
    }

    // Add created timestamp if not present
    const dataWithTimestamp = response.data.map((item) => {
      if (!item.cr) {
        item.cr = new Date(item.dt).getTime();
      }
      return item;
    });

    // Save to IndexedDB
    if (isIndexedDBAvailable()) {
      await saveExpensesToDB(dataWithTimestamp);
    }

    // Process data with Web Worker
    processDataWithWorker(dataWithTimestamp, (processedData) => {
      dataDispatch({
        type: 'SET_DATA',
        raw: dataWithTimestamp,
        ...processedData,
        totals: processedData.monthsTotals,
        loading: false,
      });

      if (category || textFilter) {
        dataDispatch({
          type: 'FILTER_DATA',
          category,
          textFilter,
        });
      }
    });
  })().finally(() => {
    expensesFetchInFlight = null;
  });

  return expensesFetchInFlight;
}

/**
 * Create expense/income
 */
export async function createExpense(
  apiClient: ApiClient,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await apiClient.post(API_ENDPOINTS.CREATE_NODE, nodeData);

  return {
    success: response.success,
    data: response.data,
    error: response.error || undefined,
  };
}

/**
 * Update expense/income
 */
export async function updateExpense(
  apiClient: ApiClient,
  id: string,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await apiClient.patch(API_ENDPOINTS.EXPENSE(id), nodeData);

  return {
    success: response.success,
    data: response.data,
    error: response.error || undefined,
  };
}

/**
 * Delete expense/income
 */
export async function deleteExpense(
  apiClient: ApiClient,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await apiClient.delete(API_ENDPOINTS.EXPENSE(id));

  return {
    success: response.success,
    error: response.error || undefined,
  };
}
