/**
 * Loans API Service
 * Centralized service for loan-related API operations
 */

import { createApiClient, ApiClient, API_ENDPOINTS } from './client';
import {
  getLoansFromDB,
  saveLoansToDB,
  getPaymentsFromDB,
  savePaymentsToDB,
  isIndexedDBAvailable,
} from '@utils/indexedDB';
import { processLoans, processPayments } from '@utils/utils';

/**
 * Fetch payments for a loan
 */
async function fetchLoanPayments(
  apiClient: ApiClient,
  loanId: string
): Promise<{ loanId: string; data: any[] }> {
  const response = await apiClient.get<any[]>(
    API_ENDPOINTS.LOAN_PAYMENTS(loanId)
  );

  if (!response.success || !response.data) {
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

/**
 * Fetch loans with offline-first approach
 */
export async function fetchLoans(
  apiClient: ApiClient,
  dataDispatch: (action: any) => void
): Promise<void> {
  // Try to load from IndexedDB first
  if (isIndexedDBAvailable()) {
    const cachedLoans = await getLoansFromDB();
    const cachedPayments = await getPaymentsFromDB();
    
    if (cachedLoans && cachedLoans.length > 0) {
      updateLoansUI(dataDispatch, cachedLoans, cachedPayments || []);
    }
  }

  // Fetch fresh data from API
  const response = await apiClient.get<any[]>(API_ENDPOINTS.LOANS);

  if (!response.success) {
    return;
  }

  if (!response.data || response.data.length === 0) {
    // Clear IndexedDB if no loans
    if (isIndexedDBAvailable()) {
      await Promise.all([
        saveLoansToDB([]),
        savePaymentsToDB([])
      ]);
    }
    updateLoansUI(dataDispatch, null, []);
    return;
  }

  // Fetch all payments in parallel
  const paymentPromises = response.data.map((loan: any) =>
    fetchLoanPayments(apiClient, loan.id)
  );
  const payments = await Promise.all(paymentPromises);

  // Process and sort loans
  const processedLoans = processLoans(response.data);

  // Save to IndexedDB
  if (isIndexedDBAvailable()) {
    await Promise.all([
      saveLoansToDB(processedLoans),
      savePaymentsToDB(payments)
    ]);
  }

  // Update UI
  updateLoansUI(dataDispatch, processedLoans, payments);
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

