/**
 * Loans API Service
 * Uses the active DataProvider (Drupal | Supabase).
 */

import type { DataProvider } from '../../../data';
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
  dataProvider: DataProvider,
  loanId: string
): Promise<{ loanId: string; data: any[] }> {
  const response = await dataProvider.listPayments(loanId);

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
  dataProvider: DataProvider,
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

    const response = await dataProvider.listLoans();

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
      (loanId) => fetchLoanPayments(dataProvider, loanId)
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
  dataProvider: DataProvider,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.createLoan(nodeData);

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
  dataProvider: DataProvider,
  id: string,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.updateLoan(id, nodeData);

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
  dataProvider: DataProvider,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await dataProvider.deleteLoan(id);

  return {
    success: response.success,
    error: response.error || undefined,
  };
}

/**
 * Create payment
 */
export async function createPayment(
  dataProvider: DataProvider,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.createPayment(nodeData);

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
  dataProvider: DataProvider,
  id: string,
  nodeData: any
): Promise<{ success: boolean; data?: any; error?: Error }> {
  const response = await dataProvider.updatePayment(id, nodeData);

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
  dataProvider: DataProvider,
  id: string
): Promise<{ success: boolean; error?: Error }> {
  const response = await dataProvider.deletePayment(id);

  return {
    success: response.success,
    error: response.error || undefined,
  };
}
