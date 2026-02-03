import { categories } from '@shared/utils/constants';
import { logout } from '@shared/context/actions';
import {
  DataStructure,
  ItemTotal,
  TransactionOrIncomeItem,
} from '@shared/type/types';
import { isIndexedDBAvailable } from './indexedDB';
import { logger } from './logger';
import { retryWithBackoff, retryPresets } from './retry';
import { createApiClient } from '@shared/api/client';
import { fetchExpenses } from '@features/expenses/api/expenses';

// API Configuration
export const API_BASE_URL = 'https://dev-expenses-api.pantheonsite.io';

const handleErrors = (
  response: Response,
  options: RequestInit,
  dataDispatch: any,
  dispatch: any
) => {
  if (!response.ok) {
    fetch(`${API_BASE_URL}/jwt/token`, options).then((response) => {
      if (response.status === 403) {
        // Add null checks before calling logout
        if (dispatch && dataDispatch) {
          logout(dispatch, dataDispatch);
        } else {
          logger.error('Dispatch functions not available for logout');
        }
      }
    });
    return response.statusText;
  }

  // Check if response has content before trying to parse JSON
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');

  // If response is empty or doesn't have JSON content, return null
  if (
    !contentType ||
    !contentType.includes('application/json') ||
    contentLength === '0'
  ) {
    return null;
  }

  // For successful responses, return the response object to be handled by the caller
  return response;
};

/**
 * Generic API fetch helper
 * Creates a standardized fetch request with authentication headers
 */
export const createAuthenticatedFetchOptions = (
  token: string,
  method: string = 'GET'
): RequestInit => {
  return {
    method,
    headers: new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'JWT-Authorization': 'Bearer ' + token,
    }),
  };
};

/**
 * Generic API fetch wrapper
 * Handles common API call patterns with authentication and error handling
 * @param showNotification - Optional notification function to show errors to user
 */
export const fetchFromAPI = <T = any>(
  url: string,
  token: string,
  dataDispatch: any,
  dispatch: any,
  onSuccess: (data: T) => void,
  method: string = 'GET',
  showNotification?: (message: string, type: string) => void
) => {
  const fetchOptions = createAuthenticatedFetchOptions(token, method);
  fetchRequest(
    url,
    fetchOptions,
    dataDispatch,
    dispatch,
    onSuccess,
    showNotification
  );
};

/**
 * @param useNullForMissing - when true, use null for months with no data (gap in line) instead of 0. Use for "Years in Review" so months before first data don't show as 0.
 */
export const formatDataForChart = (
  data: DataStructure,
  secondSet: DataStructure | false = false,
  localizedMonthNames?: string[],
  useNullForMissing = false
) => {
  const seriesData: Array<{
    name: string;
    data: Array<[string, number | null]>;
  }> = [];

  const englishMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const monthsToUse = localizedMonthNames || englishMonthNames;

  for (const year in data) {
    const yearSeries = {
      name: year,
      data: [] as Array<[string, number | null]>,
    };

    for (let i = 0; i < monthsToUse.length; i++) {
      const displayMonth = monthsToUse[i];
      const englishMonth = englishMonthNames[i];
      const monthValue = data[year][`${englishMonth} ${year}`];
      const hasValue = monthValue !== undefined && monthValue !== null;

      if (secondSet && typeof secondSet === 'object') {
        const monthValueSpent =
          secondSet[year]?.[`${englishMonth} ${year}`] ?? 0;
        const val =
          (monthValue ?? 0) -
          (typeof monthValueSpent === 'number' ? monthValueSpent : 0);
        yearSeries.data.push([displayMonth, val]);
      } else if (useNullForMissing && !hasValue) {
        yearSeries.data.push([displayMonth, null]);
      } else {
        yearSeries.data.push([displayMonth, monthValue ?? 0]);
      }
    }

    if (yearSeries.data.length > 0) {
      seriesData.push(yearSeries);
    }
  }

  return seriesData;
};

/**
 * Enhanced fetchRequest with retry logic and better error handling
 */
export const fetchRequest = (
  url: string,
  options: RequestInit,
  dataDispatch: any,
  dispatch: any,
  callback: any,
  showNotification?: (message: string, type: string) => void
) => {
  // Add null checks for dispatch functions
  if (!dataDispatch || !dispatch) {
    logger.error('Dispatch functions not available for fetch request');
    if (showNotification) {
      showNotification(
        'System error: Dispatch functions not available',
        'error'
      );
    }
    return;
  }

  // Use retry logic for fetch requests
  retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      return handleErrors(response, options, dataDispatch, dispatch);
    },
    {
      ...retryPresets.standard,
      onRetry: (attempt, error) => {
        logger.warn(`Retrying fetch request (attempt ${attempt}):`, error);
      },
    }
  )
    .then((retryResult) => {
      if (!retryResult.success) {
        // All retries failed
        logger.error('Fetch request failed after retries:', retryResult.error);

        // Show error to user if notification function is provided
        if (showNotification) {
          const errorMessage =
            retryResult.error instanceof Error
              ? retryResult.error.message
              : 'Network error. Please check your connection and try again.';
          showNotification(errorMessage, 'error');
        }

        // Call callback with error
        callback(null);
        return;
      }

      const result = retryResult.data;

      // If handleErrors returned a string (error), pass it to callback
      if (typeof result === 'string') {
        if (showNotification) {
          showNotification(result, 'error');
        }
        return callback(result);
      }

      // If handleErrors returned null (empty response), pass null to callback
      if (result === null) {
        return callback(null);
      }

      // If handleErrors returned a response object, try to parse JSON
      if (result instanceof Response) {
        return result.text().then((text) => {
          if (!text || text.trim() === '') {
            return callback(null);
          }
          try {
            const data = JSON.parse(text);
            return callback(data);
          } catch (error) {
            logger.warn('Failed to parse JSON response:', error);
            if (showNotification) {
              showNotification('Failed to parse server response', 'error');
            }
            return callback(null);
          }
        });
      }

      // For any other case, pass the result to callback
      return callback(result);
    })
    .catch((error) => {
      logger.error('Fetch request error:', error);

      // Show error to user if notification function is provided
      if (showNotification) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred. Please try again.';
        showNotification(errorMessage, 'error');
      }

      // Call callback with error so caller can handle it
      callback(null);
    });
};

export const deleteNode = async (
  nid: string,
  token: string,
  callback: any,
  dataDispatch?: any,
  loanId?: string // Optional loanId for payments
) => {
  // For transactions/income/payments: implement offline-first approach
  if (dataDispatch && isIndexedDBAvailable()) {
    try {
      const {
        deleteExpenseLocally,
        getExpensesFromDB,
        getPaymentsFromDB,
        isOnline,
      } = await import('./indexedDB');
      const {
        deleteOffline,
        deletePaymentOffline,
        updateUILocally,
        updateLoansUILocally,
      } = await import('./offlineAPI');

      // Check if it's a payment (has loanId)
      if (loanId) {
        // Handle payment deletion
        const payments = (await getPaymentsFromDB()) || [];
        const loanPayments = payments.find((p: any) => p.loanId === loanId);
        const paymentToDelete = loanPayments?.data?.find(
          (p: any) => p.id === nid
        );

        if (paymentToDelete) {
          const url = `${API_BASE_URL}/node/${nid}?_format=json`;

          // Delete offline (saves locally and adds to sync queue)
          await deletePaymentOffline(loanId, nid, url);

          // Update UI with local data
          await updateLoansUILocally(dataDispatch);

          // Call callback immediately
          callback({ ok: true } as Response);

          // Try to sync if online
          if (isOnline()) {
            const fetchOptions = createAuthenticatedFetchOptions(
              token,
              'DELETE'
            );
            fetch(url, fetchOptions)
              .then(async (response) => {
                if (response.ok) {
                  // Remove from sync queue on success
                  const { getPendingSyncOperations, removeSyncOperation } =
                    await import('./indexedDB');
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) =>
                      o.url === url &&
                      o.status === 'pending' &&
                      o.entityType === 'payment'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                }
              })
              .catch((error) => {
                console.error('Delete payment sync failed:', error);
              });
          }
        } else {
          // Payment not found locally, try to delete from server
          const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
          fetch(`${API_BASE_URL}/node/${nid}?_format=json`, fetchOptions).then(
            (response) => {
              callback(response);
            }
          );
        }
      } else {
        // Handle expense/income deletion
        const currentData = (await getExpensesFromDB()) || [];
        const itemToDelete = currentData.find((item: any) => item.id === nid);

        if (itemToDelete) {
          // Determine entity type
          const entityType =
            itemToDelete.type === 'transaction' ? 'expense' : 'income';
          const url = `${API_BASE_URL}/node/${nid}?_format=json`;

          // Delete offline (saves locally and adds to sync queue)
          await deleteOffline(nid, entityType, url);

          // Update UI with local data
          await updateUILocally(dataDispatch);

          // Call callback immediately
          callback({ ok: true } as Response);

          // Try to sync if online
          if (isOnline()) {
            const fetchOptions = createAuthenticatedFetchOptions(
              token,
              'DELETE'
            );
            fetch(url, fetchOptions)
              .then(async (response) => {
                if (response.ok) {
                  // Remove from sync queue on success
                  const { getPendingSyncOperations, removeSyncOperation } =
                    await import('./indexedDB');
                  const pendingOps = await getPendingSyncOperations();
                  const op = pendingOps.find(
                    (o) => o.url === url && o.status === 'pending'
                  );
                  if (op && op.id) {
                    await removeSyncOperation(op.id);
                  }
                }
              })
              .catch((error) => {
                console.error('Delete sync failed:', error);
              });
          }
        } else {
          // Item not found locally, try to delete from server
          const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
          fetch(`${API_BASE_URL}/node/${nid}?_format=json`, fetchOptions).then(
            (response) => {
              callback(response);
            }
          );
        }
      }
    } catch (error) {
      console.error('Error in offline delete:', error);
      // Fallback to original behavior
      const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
      fetch(`${API_BASE_URL}/node/${nid}?_format=json`, fetchOptions).then(
        (response) => {
          callback(response);
        }
      );
    }
  } else {
    // Original behavior if no dataDispatch or IndexedDB not available
    const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
    fetch(`${API_BASE_URL}/node/${nid}?_format=json`, fetchOptions).then(
      (response) => {
        callback(response);
      }
    );
  }
};

export const deleteLoan = async (
  nid: string,
  token: string,
  dataDispatch: any,
  dispatch: any,
  onSuccess: () => void
) => {
  // Add null checks for dispatch functions
  if (!dataDispatch || !dispatch) {
    console.error('Dispatch functions not available for delete loan');
    return;
  }

  // Implement offline-first approach for loans
  if (isIndexedDBAvailable()) {
    try {
      const { deleteLoanLocally, getLoansFromDB, isOnline } =
        await import('./indexedDB');
      const { deleteLoanOffline, updateLoansUILocally } =
        await import('./offlineAPI');

      // Check if loan exists in local DB
      const currentLoans = (await getLoansFromDB()) || [];
      const loanToDelete = currentLoans.find((loan: any) => loan.id === nid);

      if (loanToDelete) {
        const url = `${API_BASE_URL}/node/${nid}?_format=json`;

        // Delete offline (saves locally and adds to sync queue)
        await deleteLoanOffline(nid, url);

        // Update UI with local data
        await updateLoansUILocally(dataDispatch);

        // Call onSuccess immediately
        onSuccess();

        // Try to sync if online
        if (isOnline()) {
          const fetchOptions = createAuthenticatedFetchOptions(token, 'DELETE');
          fetch(url, fetchOptions)
            .then(async (response) => {
              if (response.ok) {
                // Remove from sync queue on success
                const { getPendingSyncOperations, removeSyncOperation } =
                  await import('./indexedDB');
                const pendingOps = await getPendingSyncOperations();
                const op = pendingOps.find(
                  (o) =>
                    o.url === url &&
                    o.status === 'pending' &&
                    o.entityType === 'loan'
                );
                if (op && op.id) {
                  await removeSyncOperation(op.id);
                }
              }
            })
            .catch((error) => {
              console.error('Delete loan sync failed:', error);
            });
        }
      } else {
        // Loan not found locally, try to delete from server
        fetchFromAPI(
          `${API_BASE_URL}/node/${nid}?_format=json`,
          token,
          dataDispatch,
          dispatch,
          onSuccess,
          'DELETE'
        );
      }
    } catch (error) {
      console.error('Error in offline delete loan:', error);
      // Fallback to original behavior
      fetchFromAPI(
        `${API_BASE_URL}/node/${nid}?_format=json`,
        token,
        dataDispatch,
        dispatch,
        onSuccess,
        'DELETE'
      );
    }
  } else {
    // Original behavior if IndexedDB not available
    fetchFromAPI(
      `${API_BASE_URL}/node/${nid}?_format=json`,
      token,
      dataDispatch,
      dispatch,
      onSuccess,
      'DELETE'
    );
  }
};

// Process data using Web Worker
export function processDataWithWorker(
  data: TransactionOrIncomeItem[],
  callback: (processedData: any) => void
) {
  if (typeof Worker === 'undefined') {
    // Fallback to synchronous processing if Web Workers are not available
    console.warn('Web Workers not available, processing synchronously');
    // Fallback: process synchronously (simplified version)
    callback(processDataSync(data));
    return;
  }

  try {
    const worker = new Worker(
      new URL('./dataProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.postMessage({
      data,
      getCategory,
    });

    worker.onmessage = (e: MessageEvent) => {
      callback(e.data);
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      // Fallback to sync processing on error
      callback(processDataSync(data));
      worker.terminate();
    };
  } catch (error) {
    console.error('Failed to create worker:', error);
    // Fallback to sync processing
    callback(processDataSync(data));
  }
}

// Synchronous fallback processing (original logic)
export function processDataSync(data: TransactionOrIncomeItem[]) {
  // First, ensure data is sorted correctly (by date descending, then by cr descending for same day)
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a.dt).getTime();
    const dateB = new Date(b.dt).getTime();
    const dateComparison = dateB - dateA;

    if (dateComparison !== 0) {
      return dateComparison;
    }

    // For same date, sort by created timestamp (descending - newest first, oldest last)
    const crA = a.cr || new Date(a.dt).getTime();
    const crB = b.cr || new Date(b.dt).getTime();
    return crB - crA;
  });

  const groupedData: Record<string, TransactionOrIncomeItem[]> = {};
  const totalsPerYearAndMonth: DataStructure = {};
  const totalPerYear: ItemTotal = {};
  const incomeData: TransactionOrIncomeItem[] = [];
  const monthsTotals: Record<string, number> = {};
  const incomeTotals: Record<string, number> = {};
  const totalIncomePerYear: ItemTotal = {};
  const totalIncomePerYearAndMonth: DataStructure = {};
  const categoryTotals: Record<string, { name: string; y: number }> = {};
  let totalSpent = 0;

  const englishMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  sortedData.forEach((item) => {
    const date = new Date(item.dt);
    const year = date.getFullYear();
    const month = `${englishMonthNames[date.getMonth()]} ${year}`;

    if (!totalsPerYearAndMonth[year]) {
      totalsPerYearAndMonth[year] = {};
    }
    if (!totalsPerYearAndMonth[year][month]) {
      totalsPerYearAndMonth[year][month] = 0;
    }
    if (!groupedData[month]) {
      groupedData[month] = [];
    }
    if (!monthsTotals[month]) {
      monthsTotals[month] = 0;
    }
    if (!incomeTotals[month]) {
      incomeTotals[month] = 0;
    }
    if (!totalIncomePerYearAndMonth[year]) {
      totalIncomePerYearAndMonth[year] = {};
    }
    if (!totalIncomePerYearAndMonth[year][month]) {
      totalIncomePerYearAndMonth[year][month] = 0;
    }
    if (!totalIncomePerYear[year]) {
      totalIncomePerYear[year] = 0;
    }
    if (!totalPerYear[year]) {
      totalPerYear[year] = 0;
    }

    const { cat, sum, type } = item;
    if (type === 'incomes') {
      totalIncomePerYear[year] =
        ((totalIncomePerYear[year] as number) || 0) + parseFloat(sum);
      totalIncomePerYearAndMonth[year][month] += parseFloat(sum);
      incomeData.push(item);
      incomeTotals[month] = parseFloat(
        (incomeTotals[month] + parseFloat(sum)).toFixed(2)
      );
    } else if (type === 'transaction') {
      groupedData[month].push(item);
      monthsTotals[month] = parseFloat(
        (monthsTotals[month] + parseFloat(sum)).toFixed(2)
      );
      if (cat && !categoryTotals[cat]) {
        categoryTotals[cat] = { name: getCategory[cat] || '', y: 0 };
      }
      if (cat && categoryTotals[cat]) {
        categoryTotals[cat].y = parseFloat(
          (categoryTotals[cat].y + parseFloat(sum)).toFixed(2)
        );
      }
      totalSpent += parseFloat(sum);
      totalsPerYearAndMonth[year][month] += parseFloat(sum);
      totalPerYear[year] =
        ((totalPerYear[year] as number) || 0) + parseFloat(sum);
    }
  });

  // Sort grouped data by date (descending) and by created timestamp (descending) for same day
  Object.keys(groupedData).forEach((month) => {
    groupedData[month].sort((a, b) => {
      const dateA = new Date(a.dt).getTime();
      const dateB = new Date(b.dt).getTime();
      const dateComparison = dateB - dateA;

      if (dateComparison !== 0) {
        return dateComparison;
      }

      // For same date, sort by created timestamp (descending - newest first, oldest last)
      const crA = a.cr || new Date(a.dt).getTime();
      const crB = b.cr || new Date(b.dt).getTime();
      return crB - crA;
    });
  });

  // Sort income data by date (descending) and by created timestamp (descending) for same day
  incomeData.sort((a, b) => {
    const dateA = new Date(a.dt).getTime();
    const dateB = new Date(b.dt).getTime();
    const dateComparison = dateB - dateA;

    if (dateComparison !== 0) {
      return dateComparison;
    }

    // For same date, sort by created timestamp (descending - newest first, oldest last)
    const crA = a.cr || new Date(a.dt).getTime();
    const crB = b.cr || new Date(b.dt).getTime();
    return crB - crA;
  });

  // Return sorted data as raw (to maintain correct order)
  return {
    groupedData,
    totalsPerYearAndMonth,
    totalPerYear,
    incomeData,
    monthsTotals,
    totals: monthsTotals, // Also include as totals for compatibility
    incomeTotals,
    totalIncomePerYear,
    totalIncomePerYearAndMonth,
    categoryTotals,
    totalSpent,
    raw: sortedData, // Return sorted data
  };
}

// Helper function to process and sort payments (exported for reuse)
export const processPayments = (payments: any[]): any[] => {
  return payments
    .map((payment: any) => {
      if (!payment.cr && payment.fdt) {
        payment.cr = new Date(payment.fdt).getTime();
      }
      return payment;
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.fdt || 0).getTime();
      const dateB = new Date(b.fdt || 0).getTime();
      const dateComparison = dateB - dateA;

      if (dateComparison !== 0) return dateComparison;

      // For same date, sort by created timestamp (descending - newest first)
      const crA = a.cr || new Date(a.fdt || 0).getTime();
      const crB = b.cr || new Date(b.fdt || 0).getTime();
      return crB - crA;
    });
};

// Helper function to process and sort loans (exported for reuse)
export const processLoans = (loans: any[]): any[] => {
  return loans
    .map((loan: any) => {
      if (!loan.cr && loan.sdt) {
        loan.cr = new Date(loan.sdt).getTime();
      }
      return loan;
    })
    .sort((a: any, b: any) => {
      const crA = a.cr || (a.sdt ? new Date(a.sdt).getTime() : 0);
      const crB = b.cr || (b.sdt ? new Date(b.sdt).getTime() : 0);
      return crB - crA; // Descending order (newest first)
    });
};

export const formatNumber = (value: unknown): string => {
  // Get user's language preference from localStorage or default to 'en'
  const language = localStorage.getItem('language') || 'en';
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';

  if (typeof value === 'number') {
    // Handle numbers directly
    return value.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } else if (typeof value === 'string') {
    // Parse the string as a number
    const parsedValue = parseFloat(value);
    if (!isNaN(parsedValue)) {
      return parsedValue.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }

  // Handle invalid input
  return '-';
};

export const getCategory: Record<string, string> = categories.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const getMonthsPassed = (firstDay: string | number | Date): number => {
  const daysPassed = parseInt(
    String((new Date().getTime() - new Date(firstDay).getTime()) / 86400000 + 1)
  );
  return daysPassed ? parseFloat(String(daysPassed / 30.42)) : 0;
};

export const transformToNumber = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  return value?.includes('.') ? parseFloat(value) : parseInt(value, 10);
};

export const transformDateFormat = (dateString: string): string => {
  const [year, month, day] = dateString.split('-');
  return `${day}.${month}.${year}`;
};

export const addOneDay = (dateStr: string) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

// Helper function to format month as "January 2024".
export const formatMonth = (date: Date) => {
  // Get user's language preference from localStorage or default to 'en'
  const language = localStorage.getItem('language') || 'en';
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';

  return new Date(date.getFullYear(), date.getMonth(), 1).toLocaleString(
    locale,
    { month: 'long', year: 'numeric' }
  );
};

// Helper function to parse month string like "January 2024" or "Ianuarie 2024" back to Date
// Safari is stricter with Date parsing, so we need a reliable method
export const parseMonthString = (monthString: string): Date | null => {
  if (!monthString || typeof monthString !== 'string') {
    return null;
  }

  // Try Date.parse first (works in most browsers)
  const parsed = Date.parse(monthString);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  // Fallback: manual parsing for Safari compatibility
  // Format is "MonthName Year" (e.g., "January 2024" or "Ianuarie 2024")
  const parts = monthString.trim().split(' ');
  if (parts.length < 2) {
    return null;
  }

  const year = parseInt(parts[parts.length - 1], 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return null;
  }

  // Get month names for both languages
  const language = localStorage.getItem('language') || 'en';
  const englishMonthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const romanianMonthNames = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];

  const monthNames = language === 'ro' ? romanianMonthNames : englishMonthNames;
  const monthName = parts.slice(0, -1).join(' '); // Handle multi-word months if any
  const monthIndex = monthNames.findIndex(
    (name) => name.toLowerCase() === monthName.toLowerCase()
  );

  if (monthIndex === -1) {
    // Try the other language
    const otherMonthNames =
      language === 'ro' ? englishMonthNames : romanianMonthNames;
    const otherMonthIndex = otherMonthNames.findIndex(
      (name) => name.toLowerCase() === monthName.toLowerCase()
    );
    if (otherMonthIndex !== -1) {
      return new Date(year, otherMonthIndex, 1);
    }
    return null;
  }

  return new Date(year, monthIndex, 1);
};

// Helper function to format month option from YYYY-MM format
export const formatMonthOption = (
  monthValue: string,
  language: string = localStorage.getItem('language') || 'en'
): { value: string; label: string } => {
  const [year, month] = monthValue.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';
  const label = date.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  return { value: monthValue, label };
};

// Helper function to get locale based on language
export const getLocale = (
  language: string = localStorage.getItem('language') || 'en'
): string => {
  return language === 'ro' ? 'ro-RO' : 'en-US';
};

// Helper function to extract unique months from raw data in YYYY-MM format
export const extractMonthsFromRawData = (rawData: any[]): string[] => {
  if (!rawData || rawData.length === 0) return [];

  const monthsSet = new Set<string>();

  rawData.forEach((item: any) => {
    if (!item.dt) return;
    const date = new Date(item.dt);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthValue = `${year}-${month}`;

    if (year >= 1900 && year <= 2100) {
      monthsSet.add(monthValue);
    }
  });

  return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
};

export const calculateDaysFrom = (
  firstDate: string | number | Date,
  dateString: string | number | Date | null = null
) => {
  const givenDate = new Date(firstDate); // Parse the input date string
  const currentDate = !dateString ? new Date() : new Date(dateString); // Get the current date

  // Calculate the difference in time (in milliseconds)
  const timeDifference = currentDate.getTime() - givenDate.getTime();

  // Convert milliseconds to days (1 day = 24 * 60 * 60 * 1000 ms)
  const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

  return daysDifference;
};

export type LoanStatus = 'completed' | 'active' | 'pending';

export const getLoanStatus = (status?: string): LoanStatus => {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'active';
  return 'pending';
};

/**
 * Check if an income item has a specific tag
 * Tags are expected to be in the description field with format #tag
 * @param item - Income item to check
 * @param tag - Tag to search for (without #)
 * @returns true if item has the tag
 */
export const hasTag = (item: TransactionOrIncomeItem, tag: string): boolean => {
  if (!item.dsc) return false;
  const description = item.dsc.toLowerCase();
  const tagPattern = `#${tag.toLowerCase()}`;
  return description.includes(tagPattern);
};

/**
 * Extract hashtags from a text string
 * @param text - Text to extract hashtags from
 * @returns Array of hashtags (without #)
 */
export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  // Match # followed by word characters, hyphens, and underscores (e.g., #apartment-rent, #tag_name)
  // Word boundary ensures we don't match in the middle of words
  const hashtagRegex = /#([\w-]+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return matches.map((match) => match.substring(1)); // Remove #
};

/**
 * Check if a text contains a specific tag (without #)
 * @param text - Text to check
 * @param tag - Tag to search for (without #)
 * @returns true if tag exists in text
 */
export const hasTagInText = (text: string, tag: string): boolean => {
  if (!text || !tag) return false;
  const tagPattern = new RegExp(`#${tag}\\b`, 'gi');
  return tagPattern.test(text);
};

/**
 * Add a tag to text (at the end)
 * @param text - Original text
 * @param tag - Tag to add (without #)
 * @returns Text with tag added
 */
export const addTagToText = (text: string, tag: string): string => {
  if (!tag) return text;
  const trimmedText = text.trim();
  const tagWithHash = `#${tag}`;
  if (!trimmedText) {
    return tagWithHash;
  }
  // Check if tag already exists
  if (hasTagInText(trimmedText, tag)) {
    return trimmedText;
  }
  return `${trimmedText} ${tagWithHash}`;
};

/**
 * Remove a tag from text
 * @param text - Original text
 * @param tag - Tag to remove (without #)
 * @returns Text with tag removed
 */
export const removeTagFromText = (text: string, tag: string): string => {
  if (!text || !tag) return text;
  const tagPattern = new RegExp(`#${tag}\\b`, 'gi');
  return text.replace(tagPattern, '').replace(/\s+/g, ' ').trim();
};

/**
 * Maps category ID to category name for translation keys
 */
const categoryNameMap: Record<string, string> = {
  '1': 'clothing',
  '2': 'entertainment',
  '3': 'food',
  '4': 'gifts',
  '5': 'household',
  '6': 'housing',
  '7': 'health',
  '8': 'personal',
  '9': 'transport',
  '10': 'utilities',
  '11': 'travel',
  '12': 'family',
  '13': 'investment',
  '14': 'alcohol',
};

/**
 * Maps suggestion text to translation key format
 * This handles special cases where the translation key doesn't match a simple normalization
 */
const suggestionKeyMap: Record<string, Record<string, string>> = {
  entertainment: {
    'happy hour': 'happyHour',
    'ceai/cafea': 'ceaiCafea',
    ingetata: 'ingetata',
  },
  food: {
    'straus/glovo food': 'strausGlovo',
    inghetata: 'inghetata',
  },
  gifts: {
    'zi de nastere': 'ziDeNastere',
  },
  household: {
    'igiena/curatinie': 'igiena',
  },
  housing: {
    'rata la jakala/ffw': 'rataJakala',
    'rata la ipoteca': 'rataIpoteca',
    'rata la cred de consum': 'rataCredConsum',
    'apartment rent': 'apartmentRent',
  },
  transport: {
    'car service': 'carService',
    'lichid parbriz': 'lichidParbriz',
    'car wash': 'carWash',
  },
  family: {
    gradinita: 'gradinita',
    jucarii: 'jucarii',
    'teren de joaca': 'terenJoaca',
  },
};

/**
 * Normalizes suggestion text to match translation key format
 * First checks the map, then falls back to camelCase conversion
 */
const normalizeSuggestionKey = (
  suggestion: string,
  categoryName: string
): string => {
  // Check if there's a direct mapping
  const categoryMap = suggestionKeyMap[categoryName];
  if (categoryMap && categoryMap[suggestion.toLowerCase()]) {
    return categoryMap[suggestion.toLowerCase()];
  }

  // Convert to camelCase: "happy hour" -> "happyHour", "ceai/cafea" -> "ceaiCafea"
  return suggestion
    .toLowerCase()
    .split(/[\s\/]+/)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('')
    .replace(/[^a-z0-9]/g, ''); // Remove any remaining special characters
};

/**
 * Gets the translation key for a suggestion based on category
 */
export const getSuggestionTranslationKey = (
  suggestion: string,
  category: string | number
): string => {
  const categoryName = categoryNameMap[String(category)];
  if (!categoryName) return suggestion;

  const normalizedKey = normalizeSuggestionKey(suggestion, categoryName);
  return `suggestions.${categoryName}.${normalizedKey}`;
};
