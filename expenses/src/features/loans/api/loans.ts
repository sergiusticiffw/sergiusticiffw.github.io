/**
 * Loans API Service
 * Centralized service for loan-related API operations
 */

import { ApiClient, API_ENDPOINTS } from '@shared/api/client';
import {
  getLoansFromDB,
  saveLoansToDB,
  getPaymentsFromDB,
  savePaymentsToDB,
  isIndexedDBAvailable,
  hasPendingSyncOperations,
} from '@shared/utils/indexedDB';
import { processLoans } from '@shared/utils/utils';
import { updateLoansUILocally } from '@shared/utils/offlineAPI';
import { decodeBundleRecord } from '../../../crypto/nodeCodec';
import { isMigrationActive, reportCorrupt } from '../../../crypto/encryptionState';

/**
 * Fetch payments for a loan; on API failure, reuse cached payments for this loan if present.
 */
async function fetchLoanPayments(
  apiClient: ApiClient,
  loanId: string
): Promise<{ loanId: string; data: any[] }> {
  const response = await apiClient.get<any[]>(
    API_ENDPOINTS.LOAN_PAYMENTS(loanId)
  );

  if (!response.success || !response.data) {
    if (isIndexedDBAvailable()) {
      const cached = await getPaymentsFromDB();
      const row = cached?.find((p: { loanId?: string }) => p.loanId === loanId);
      if (row?.data?.length) {
        return { loanId, data: row.data };
      }
    }
    return { loanId, data: [] };
  }

  return { loanId, data: response.data };
}

/**
 * Update loans UI
 */
function updateLoansUI(
  dataDispatch: (action: any) => void,
  loans: any[] | null,
  payments: any[]
): void {
  dataDispatch({
    type: 'SET_DATA',
    loans,
    payments,
    loading: false,
  });
}

// Prevent duplicate parallel fetches (e.g. React StrictMode double-effects in dev)
let loansFetchInFlight: Promise<void> | null = null;

/**
 * Fetch loans with offline-first approach
 */
export async function fetchLoans(
  apiClient: ApiClient,
  dataDispatch: (action: any) => void
): Promise<void> {
  if (loansFetchInFlight) {
    return loansFetchInFlight;
  }

  loansFetchInFlight = (async () => {
    // Try to load from IndexedDB first
    if (isIndexedDBAvailable()) {
      const cachedLoans = await getLoansFromDB();
      const cachedPayments = await getPaymentsFromDB();

      if (cachedLoans && cachedLoans.length > 0) {
        updateLoansUI(dataDispatch, cachedLoans, cachedPayments || []);
      }
    }

    if (isMigrationActive()) {
      return;
    }

    // Fetch fresh data from API
    const response = await apiClient.get<any[]>(API_ENDPOINTS.LOANS);

    if (!response.success || !response.data) {
      if (isIndexedDBAvailable()) {
        await updateLoansUILocally(dataDispatch);
      } else {
        updateLoansUI(dataDispatch, null, []);
      }
      return;
    }

    if (response.data.length === 0) {
      if (isIndexedDBAvailable()) {
        await Promise.all([saveLoansToDB([]), savePaymentsToDB([])]);
      }
      updateLoansUI(dataDispatch, null, []);
      return;
    }

    const cachedLoans = isIndexedDBAvailable() ? (await getLoansFromDB()) || [] : [];
    const cachedPayments = isIndexedDBAvailable()
      ? (await getPaymentsFromDB()) || []
      : [];
    const decoded = await decodeLoanBundle(
      response.data,
      cachedLoans,
      cachedPayments,
      (loanId) => fetchLoanPayments(apiClient, loanId)
    );
    reportCorrupt('loans', decoded.corrupt);
    if (decoded.lockedLoans > 0 && decoded.loans.length === 0) {
      if (cachedLoans.length === 0) {
        updateLoansUI(dataDispatch, null, cachedPayments);
      }
      return;
    }

    const payments = decoded.payments;
    const processedLoans = processLoans(decoded.loans);

    if (isIndexedDBAvailable()) {
      // If there are pending local changes, don't overwrite local cache/UI with server snapshot.
      // Local cache was already loaded above; sync will reconcile when online.
      const hasPending = await hasPendingSyncOperations(['loan', 'payment']);
      if (hasPending) {
        await updateLoansUILocally(dataDispatch);
        return;
      }
      await Promise.all([
        saveLoansToDB(processedLoans),
        savePaymentsToDB(payments),
      ]);
    }

    updateLoansUI(dataDispatch, processedLoans, payments);
  })().finally(() => {
    loansFetchInFlight = null;
  });

  return loansFetchInFlight;
}

async function decodeLoanBundle(
  serverLoans: any[],
  cachedLoans: any[],
  cachedPayments: Array<{ loanId?: string; data?: any[] }>,
  loadPayments: (loanId: string) => Promise<{ loanId: string; data: any[] }>
): Promise<{ loans: any[]; payments: any[]; corrupt: number; lockedLoans: number }> {
  const loans: any[] = [];
  const payments: any[] = [];
  let corrupt = 0;
  let lockedLoans = 0;

  for (const loan of serverLoans) {
    const loanId = String(loan.id);
    const decodedLoan = await decodeBundleRecord(loan, 'loan');
    if (decodedLoan.kind === 'ok') {
      loans.push(decodedLoan.item);
    } else {
      lockedLoans += 1;
      if (decodedLoan.kind === 'corrupt') corrupt += 1;
      const local = cachedLoans.find((item) => String(item.id) === loanId);
      if (local) loans.push(local);
    }

    const group = await loadPayments(loanId);
    const kept: any[] = [];
    const preserve = new Set<string>();
    for (const payment of group.data || []) {
      const decodedPayment = await decodeBundleRecord(payment, 'payment');
      if (decodedPayment.kind === 'ok') {
        kept.push(decodedPayment.item);
      } else {
        if (decodedPayment.kind === 'corrupt') corrupt += 1;
        preserve.add(String(payment.id));
      }
    }
    if (preserve.size) {
      const cached = cachedPayments.find((row) => row.loanId === loanId);
      for (const id of preserve) {
        const local = cached?.data?.find((item) => String(item.id) === id);
        if (local && !kept.some((item) => String(item.id) === id)) kept.push(local);
      }
    }
    payments.push({ loanId, data: kept });
  }

  return { loans, payments, corrupt, lockedLoans };
}

/**
 * Create loan
 */
export async function createLoan(
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
 * Update loan
 */
export async function updateLoan(
  apiClient: ApiClient,
  id: string,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await apiClient.patch(API_ENDPOINTS.LOAN(id), nodeData);

  return {
    success: response.success,
    data: response.data,
    error: response.error || undefined,
  };
}

/**
 * Delete loan
 */
export async function deleteLoan(
  apiClient: ApiClient,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await apiClient.delete(API_ENDPOINTS.LOAN(id));

  return {
    success: response.success,
    error: response.error || undefined,
  };
}

/**
 * Create payment
 */
export async function createPayment(
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
 * Update payment
 */
export async function updatePayment(
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
 * Delete payment
 */
export async function deletePayment(
  apiClient: ApiClient,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await apiClient.delete(API_ENDPOINTS.EXPENSE(id));

  return {
    success: response.success,
    error: response.error || undefined,
  };
}
