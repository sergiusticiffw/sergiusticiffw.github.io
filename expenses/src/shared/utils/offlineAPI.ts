// Offline API utilities - handles operations when offline
import {
  saveExpenseLocally,
  deleteExpenseLocally,
  getExpensesFromDB,
  saveLoanLocally,
  deleteLoanLocally,
  getLoansFromDB,
  savePaymentLocally,
  deletePaymentLocally,
  getPaymentsFromDB,
  addToSyncQueue,
} from '@shared/utils/indexedDB';
import { processDataSync, processLoans } from '@shared/utils/utils';
import { TransactionOrIncomeItem } from '@shared/type/types';

// Save transaction/income offline
export async function saveOffline(
  item: TransactionOrIncomeItem,
  node: any,
  formType: 'add' | 'edit',
  entityType: 'expense' | 'income',
  url: string,
  method: string
): Promise<string> {
  // Generate temporary ID if new
  if (formType === 'add' && !item.id) {
    item.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save locally
  await saveExpenseLocally(item, formType === 'add');

  // Add to sync queue
  await addToSyncQueue({
    type: formType === 'add' ? 'create' : 'update',
    entityType,
    url,
    method,
    data: node,
    localId: item.id,
  });

  return item.id!;
}

// Delete transaction/income offline
export async function deleteOffline(
  id: string,
  entityType: 'expense' | 'income',
  url: string
): Promise<void> {
  // Delete locally
  await deleteExpenseLocally(id);

  // Add to sync queue
  await addToSyncQueue({
    type: 'delete',
    entityType,
    url,
    method: 'DELETE',
    localId: id,
  });
}

// Save loan offline
export async function saveLoanOffline(
  item: any,
  node: any,
  formType: 'add' | 'edit',
  url: string,
  method: string
): Promise<string> {
  // Generate temporary ID if new
  if (formType === 'add' && !item.id) {
    item.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save locally
  await saveLoanLocally(item, formType === 'add');

  // Add to sync queue
  await addToSyncQueue({
    type: formType === 'add' ? 'create' : 'update',
    entityType: 'loan',
    url,
    method,
    data: node,
    localId: item.id,
  });

  return item.id!;
}

// Delete loan offline
export async function deleteLoanOffline(
  id: string,
  url: string
): Promise<void> {
  // Delete locally
  await deleteLoanLocally(id);

  // Add to sync queue
  await addToSyncQueue({
    type: 'delete',
    entityType: 'loan',
    url,
    method: 'DELETE',
    localId: id,
  });
}

// Save payment offline
export async function savePaymentOffline(
  loanId: string,
  payment: any,
  node: any,
  formType: 'add' | 'edit',
  url: string,
  method: string
): Promise<string> {
  // Generate temporary ID if new
  if (formType === 'add' && !payment.id) {
    payment.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save locally
  await savePaymentLocally(loanId, payment, formType === 'add');

  // Add to sync queue
  await addToSyncQueue({
    type: formType === 'add' ? 'create' : 'update',
    entityType: 'payment',
    url,
    method,
    data: node,
    localId: payment.id,
  });

  return payment.id!;
}

// Delete payment offline
export async function deletePaymentOffline(
  loanId: string,
  paymentId: string,
  url: string
): Promise<void> {
  // Delete locally
  await deletePaymentLocally(loanId, paymentId);

  // Add to sync queue
  await addToSyncQueue({
    type: 'delete',
    entityType: 'payment',
    url,
    method: 'DELETE',
    localId: paymentId,
  });
}

// Update UI with local data (for expenses/income)
export async function updateUILocally(dataDispatch: any): Promise<void> {
  const updatedData = (await getExpensesFromDB()) || [];
  const processedData = processDataSync(updatedData);

  dataDispatch({
    type: 'SET_DATA',
    raw: processedData.raw || updatedData, // Use sorted data from processDataSync
    ...processedData,
    totals: processedData.monthsTotals,
    loading: false,
  });
}

// Update UI with local loans/payments data
export async function updateLoansUILocally(dataDispatch: any): Promise<void> {
  const loans = (await getLoansFromDB()) || [];
  const payments = (await getPaymentsFromDB()) || [];

  // Ensure loans are sorted consistently (by cr descending, newest first)
  const sortedLoans = loans.length > 0 ? processLoans(loans) : null;

  dataDispatch({
    type: 'SET_DATA',
    loans: sortedLoans,
    payments,
    loading: false,
  });
}
