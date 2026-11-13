/**
 * Expenses API Service
 * Uses the active DataProvider (Drupal | Supabase).
 */

import type { DataProvider } from '../../../data';
import { TransactionOrIncomeItem } from '@shared/type/types';
import {
  getExpensesFromDB,
  saveExpensesToDB,
  isIndexedDBAvailable,
  hasPendingSyncOperations,
} from '@shared/utils/indexedDB';
import { processDataWithWorker, processDataSync } from '@shared/utils/utils';
import { decodeServerItem } from '../../../crypto/nodeCodec';
import {
  isMigrationActive,
  reportCorrupt,
} from '../../../crypto/encryptionState';

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
  dataProvider: DataProvider,
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

    if (isMigrationActive()) {
      return;
    }

    const response = await dataProvider.listTransactions();

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

    const decoded = await decodeExpenseRecords(response.data);
    reportCorrupt('expenses', decoded.corrupt);
    const cachedForPreserve = isIndexedDBAvailable()
      ? (await getExpensesFromDB()) || []
      : [];
    if (decoded.locked > 0 && decoded.items.length === 0) {
      if (cachedForPreserve.length === 0) {
        dataDispatch({ type: 'SET_DATA', raw: [], loading: false });
      }
      return;
    }

    const merged = new Map(decoded.items.map((item) => [item.id, item]));
    for (const id of decoded.preserveIds) {
      const local = cachedForPreserve.find((item) => item.id === id);
      if (local && !merged.has(id)) merged.set(id, local);
    }
    const dataWithTimestamp = Array.from(merged.values());

    // Save to IndexedDB (skip overwriting local cache while expense/income sync is pending)
    if (isIndexedDBAvailable()) {
      const hasPending = await hasPendingSyncOperations(['expense', 'income']);
      if (hasPending) {
        const cachedData = await getExpensesFromDB();
        if (cachedData && cachedData.length > 0) {
          processDataWithWorker(cachedData, (processedData) => {
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
          });
        } else {
          dataDispatch({ type: 'SET_DATA', raw: [], loading: false });
        }
        return;
      }
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

async function decodeExpenseRecords(records: any[]): Promise<{
  items: TransactionOrIncomeItem[];
  preserveIds: string[];
  locked: number;
  corrupt: number;
}> {
  const items: TransactionOrIncomeItem[] = [];
  const preserveIds: string[] = [];
  let locked = 0;
  let corrupt = 0;

  for (const record of records) {
    const { payload, field_encrypted_payload, encrypted_payload, ...rest } =
      record || {};
    const dt = rest.dt ? String(rest.dt) : '';
    const base: TransactionOrIncomeItem = {
      ...rest,
      id: String(rest.id ?? ''),
      dt,
      sum: rest.sum === undefined || rest.sum === null ? '' : String(rest.sum),
      type: rest.type || 'transaction',
      cr: rest.cr || (dt ? new Date(dt).getTime() : Date.now()),
    };
    const result = await decodeServerItem(
      { ...record, payload, field_encrypted_payload, encrypted_payload },
      base
    );
    if (result.kind === 'ok') {
      items.push(result.item);
    } else {
      preserveIds.push(result.id);
      if (result.kind === 'locked') locked += 1;
      else corrupt += 1;
    }
  }

  return { items, preserveIds, locked, corrupt };
}

/**
 * Create expense/income
 */
export async function createExpense(
  dataProvider: DataProvider,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.createTransaction(nodeData);

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
  dataProvider: DataProvider,
  id: string,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.updateTransaction(id, nodeData);

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
  dataProvider: DataProvider,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await dataProvider.deleteTransaction(id);

  return {
    success: response.success,
    error: response.error || undefined,
  };
}
