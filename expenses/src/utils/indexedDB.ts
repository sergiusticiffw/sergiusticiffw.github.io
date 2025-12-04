// IndexedDB utilities for caching expense data
import { processLoans, processPayments } from '@utils/utils';
import { logger } from '@utils/logger';

const DB_NAME = 'expensesDB';
const DB_VERSION = 3; // Incremented for sync queue store
const STORE_EXPENSES = 'expenses';
const STORE_LOANS = 'loans';
const STORE_PAYMENTS = 'payments';
const STORE_SYNC_QUEUE = 'syncQueue';

// Open IndexedDB database
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create expenses store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
        db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' });
      }

      // Create loans store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_LOANS)) {
        db.createObjectStore(STORE_LOANS, { keyPath: 'id' });
      }

      // Create payments store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_PAYMENTS)) {
        db.createObjectStore(STORE_PAYMENTS, { keyPath: 'loanId' });
      }

      // Create sync queue store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Save expense data to IndexedDB
export async function saveExpensesToDB(data: any[]): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_EXPENSES, 'readwrite');
    const store = transaction.objectStore(STORE_EXPENSES);

    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Add all items
    const addPromises = data.map(
      (item) =>
        new Promise<void>((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
    );

    await Promise.all(addPromises);
    transaction.oncomplete = () => db.close();
  } catch (error) {
    logger.error('Error saving expenses to IndexedDB:', error);
  }
}

// Sort expenses consistently (by date descending, then by created timestamp descending for same day)
function sortExpenses(data: any[]): any[] {
  return data.sort((a, b) => {
    // First sort by date (descending - newest dates first)
    const dateA = new Date(a.dt).getTime();
    const dateB = new Date(b.dt).getTime();
    const dateComparison = dateB - dateA;

    // If dates are different, return date comparison
    if (dateComparison !== 0) {
      return dateComparison;
    }

    // For same date, sort by created timestamp (descending - newest first, oldest last)
    // This ensures new items appear at the beginning of the same day
    const crA = a.cr || new Date(a.dt).getTime();
    const crB = b.cr || new Date(b.dt).getTime();
    return crB - crA; // Descending order (newest first, oldest last)
  });
}

// Get expense data from IndexedDB (sorted consistently)
export async function getExpensesFromDB(): Promise<any[] | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_EXPENSES, 'readonly');
    const store = transaction.objectStore(STORE_EXPENSES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result as any[];
        transaction.oncomplete = () => db.close();
        // Sort data before returning to match API response order
        const sortedData = data.length > 0 ? sortExpenses(data) : null;
        resolve(sortedData);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error reading expenses from IndexedDB:', error);
    return null;
  }
}

// Sort loans consistently (by created timestamp descending, newest first)
// Uses exported helper function for consistency
const sortLoans = processLoans;

// Save loans data to IndexedDB
export async function saveLoansToDB(data: any[]): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_LOANS, 'readwrite');
    const store = transaction.objectStore(STORE_LOANS);

    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Add all items
    const addPromises = data.map(
      (item) =>
        new Promise<void>((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
    );

    await Promise.all(addPromises);
    transaction.oncomplete = () => db.close();
  } catch (error) {
    logger.error('Error saving loans to IndexedDB:', error);
  }
}

// Get loans data from IndexedDB (sorted consistently)
export async function getLoansFromDB(): Promise<any[] | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_LOANS, 'readonly');
    const store = transaction.objectStore(STORE_LOANS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result as any[];
        transaction.oncomplete = () => db.close();
        // Sort data before returning to match consistent order
        const sortedData = data.length > 0 ? sortLoans(data) : null;
        resolve(sortedData);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error reading loans from IndexedDB:', error);
    return null;
  }
}

// Save payments data to IndexedDB
export async function savePaymentsToDB(payments: any[]): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_PAYMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_PAYMENTS);

    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Add all items (payments are stored with loanId as key)
    const addPromises = payments.map(
      (item) =>
        new Promise<void>((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
    );

    await Promise.all(addPromises);
    transaction.oncomplete = () => db.close();
  } catch (error) {
    logger.error('Error saving payments to IndexedDB:', error);
  }
}

// Sort payments consistently (by created timestamp descending, newest first)
function sortPayments(payments: any[]): any[] {
  // Payments are stored by loanId, so we need to sort payments within each loan
  return payments.map((loanPayment) => {
    if (loanPayment.data && Array.isArray(loanPayment.data)) {
      // Use helper function for consistent sorting
      loanPayment.data = processPayments(loanPayment.data);
    }
    return loanPayment;
  });
}

// Get payments data from IndexedDB (sorted consistently)
export async function getPaymentsFromDB(): Promise<any[] | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_PAYMENTS, 'readonly');
    const store = transaction.objectStore(STORE_PAYMENTS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result as any[];
        transaction.oncomplete = () => db.close();
        // Sort payments before returning to match consistent order
        const sortedData = data.length > 0 ? sortPayments(data) : null;
        resolve(sortedData);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error reading payments from IndexedDB:', error);
    return null;
  }
}

// Clear all data from IndexedDB (expenses, loans, and payments)
export async function clearExpensesDB(): Promise<void> {
  try {
    const db = await openDB();

    // Clear expenses
    const expensesTransaction = db.transaction(STORE_EXPENSES, 'readwrite');
    const expensesStore = expensesTransaction.objectStore(STORE_EXPENSES);
    await new Promise<void>((resolve, reject) => {
      const request = expensesStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      expensesTransaction.oncomplete = () => {};
    });

    // Clear loans
    const loansTransaction = db.transaction(STORE_LOANS, 'readwrite');
    const loansStore = loansTransaction.objectStore(STORE_LOANS);
    await new Promise<void>((resolve, reject) => {
      const request = loansStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      loansTransaction.oncomplete = () => {};
    });

    // Clear payments
    const paymentsTransaction = db.transaction(STORE_PAYMENTS, 'readwrite');
    const paymentsStore = paymentsTransaction.objectStore(STORE_PAYMENTS);
    await new Promise<void>((resolve, reject) => {
      const request = paymentsStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      paymentsTransaction.oncomplete = () => db.close();
    });
  } catch (error) {
    logger.error('Error clearing IndexedDB:', error);
  }
}

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Save a single expense/income item locally
export async function saveExpenseLocally(
  item: any,
  isNew: boolean = false
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_EXPENSES, 'readwrite');
    const store = transaction.objectStore(STORE_EXPENSES);

    // Add timestamp if new
    if (isNew && !item.cr) {
      item.cr = Date.now();
    }

    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error saving expense locally:', error);
    throw error;
  }
}

// Delete a single expense/income item locally
export async function deleteExpenseLocally(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_EXPENSES, 'readwrite');
    const store = transaction.objectStore(STORE_EXPENSES);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error deleting expense locally:', error);
    throw error;
  }
}

// Save a single loan locally
export async function saveLoanLocally(
  item: any,
  isNew: boolean = false
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_LOANS, 'readwrite');
    const store = transaction.objectStore(STORE_LOANS);

    // Add timestamp if new
    if (isNew && !item.cr) {
      item.cr = Date.now();
    }

    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error saving loan locally:', error);
    throw error;
  }
}

// Delete a single loan locally
export async function deleteLoanLocally(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_LOANS, 'readwrite');
    const store = transaction.objectStore(STORE_LOANS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error deleting loan locally:', error);
    throw error;
  }
}

// Save a single payment locally (payments are stored by loanId)
export async function savePaymentLocally(
  loanId: string,
  payment: any,
  isNew: boolean = false
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_PAYMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_PAYMENTS);

    // Get existing payments for this loan
    const existingPayments = await new Promise<any>((resolve) => {
      const req = store.get(loanId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    let paymentsData = existingPayments?.data || [];

    if (isNew) {
      // Add new payment
      if (!payment.id) {
        payment.id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!payment.cr) {
        payment.cr = Date.now();
      }
      paymentsData.push(payment);
    } else {
      // Update existing payment
      const index = paymentsData.findIndex((p: any) => p.id === payment.id);
      if (index >= 0) {
        paymentsData[index] = payment;
      } else {
        paymentsData.push(payment);
      }
    }

    // Save updated payments
    const updatedPayments = {
      loanId,
      data: paymentsData,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(updatedPayments);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error saving payment locally:', error);
    throw error;
  }
}

// Delete a single payment locally
export async function deletePaymentLocally(
  loanId: string,
  paymentId: string
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_PAYMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_PAYMENTS);

    // Get existing payments for this loan
    const existingPayments = await new Promise<any>((resolve) => {
      const req = store.get(loanId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (existingPayments && existingPayments.data) {
      // Remove payment from array
      existingPayments.data = existingPayments.data.filter(
        (p: any) => p.id !== paymentId
      );

      // Save updated payments
      return new Promise((resolve, reject) => {
        const request = store.put(existingPayments);
        request.onsuccess = () => {
          transaction.oncomplete = () => db.close();
          resolve();
        };
        request.onerror = () => {
          transaction.oncomplete = () => db.close();
          reject(request.error);
        };
      });
    }
  } catch (error) {
    logger.error('Error deleting payment locally:', error);
    throw error;
  }
}

// Sync queue operations
export interface SyncOperation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  entityType: 'expense' | 'income' | 'loan' | 'payment';
  url: string;
  method: string;
  data?: any;
  localId?: string;
  status?: 'pending' | 'synced' | 'failed';
  retries?: number;
}

// Add operation to sync queue
export async function addToSyncQueue(operation: SyncOperation): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);

    const syncOp: SyncOperation = {
      ...operation,
      status: 'pending',
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(syncOp);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error adding to sync queue:', error);
    throw error;
  }
}

// Get pending sync operations
export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error getting pending sync operations:', error);
    return [];
  }
}

// Remove sync operation
export async function removeSyncOperation(id: number): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        transaction.oncomplete = () => db.close();
        resolve();
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error removing sync operation:', error);
    throw error;
  }
}

// Update sync operation status
export async function updateSyncOperationStatus(
  id: number,
  status: 'pending' | 'synced' | 'failed',
  retries?: number
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.status = status;
          if (retries !== undefined) {
            operation.retries = retries;
          }
          const putRequest = store.put(operation);
          putRequest.onsuccess = () => {
            transaction.oncomplete = () => db.close();
            resolve();
          };
          putRequest.onerror = () => {
            transaction.oncomplete = () => db.close();
            reject(putRequest.error);
          };
        } else {
          transaction.oncomplete = () => db.close();
          resolve();
        }
      };
      getRequest.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(getRequest.error);
      };
    });
  } catch (error) {
    logger.error('Error updating sync operation status:', error);
    throw error;
  }
}

// Update localId and URL for pending operations that reference a temp ID
export async function updateSyncOperationsWithNewId(
  oldLocalId: string,
  newLocalId: string,
  entityType: 'expense' | 'income' | 'loan' | 'payment'
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => {
        const operations = request.result || [];
        let updated = false;

        operations.forEach((op: SyncOperation) => {
          // Update operations that reference the old temp ID
          if (
            op.localId === oldLocalId &&
            op.entityType === entityType &&
            op.type !== 'create'
          ) {
            op.localId = newLocalId;
            // Reconstruct URL with new ID (safer than replace)
            const API_BASE_URL = 'https://dev-expenses-api.pantheonsite.io';
            if (op.type === 'update' || op.type === 'delete') {
              op.url = `${API_BASE_URL}/node/${newLocalId}?_format=json`;
            }
            store.put(op);
            updated = true;
          }
        });

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };

        if (!updated) {
          // No operations to update, resolve immediately
          resolve();
        }
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error updating sync operations with new ID:', error);
    throw error;
  }
}

// Clean up invalid sync operations (items that don't exist in local DB)
export async function cleanupInvalidSyncOperations(): Promise<number> {
  try {
    const db = await openDB();
    const transaction = db.transaction(
      [STORE_SYNC_QUEUE, STORE_EXPENSES, STORE_LOANS, STORE_PAYMENTS],
      'readwrite'
    );
    const syncStore = transaction.objectStore(STORE_SYNC_QUEUE);
    const expensesStore = transaction.objectStore(STORE_EXPENSES);
    const loansStore = transaction.objectStore(STORE_LOANS);
    const paymentsStore = transaction.objectStore(STORE_PAYMENTS);
    const index = syncStore.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => {
        const operations = request.result || [];
        let cleanedCount = 0;
        const operationsToDelete: number[] = [];

        const checkOperation = async (op: SyncOperation, index: number) => {
          if (!op.localId) {
            operationsToDelete.push(op.id!);
            return;
          }

          // For create operations, skip cleanup (they should be synced)
          if (op.type === 'create') {
            return;
          }

          // For delete operations, skip cleanup (item might not exist because we deleted it locally)
          if (op.type === 'delete') {
            return;
          }

          // Check if item exists in local DB (only for update operations)
          let itemExists = false;

          if (op.entityType === 'expense' || op.entityType === 'income') {
            const item = await new Promise<any>((resolve) => {
              const req = expensesStore.get(op.localId);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            itemExists = !!item;
          } else if (op.entityType === 'loan') {
            const item = await new Promise<any>((resolve) => {
              const req = loansStore.get(op.localId);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });
            itemExists = !!item;
          } else if (op.entityType === 'payment') {
            // For payments, check in payments store
            const payments = await new Promise<any[]>((resolve) => {
              const req = paymentsStore.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            });
            itemExists = payments.some((p: any) =>
              p.data?.some((pay: any) => pay.id === op.localId)
            );
          }

          // If item doesn't exist and it's not a create operation, mark for deletion
          if (!itemExists) {
            operationsToDelete.push(op.id!);
          }
        };

        // Check all operations
        if (operations.length === 0) {
          transaction.oncomplete = () => {
            db.close();
            resolve(0);
          };
          return;
        }

        Promise.all(operations.map((op, idx) => checkOperation(op, idx)))
          .then(() => {
            // Delete invalid operations
            if (operationsToDelete.length > 0) {
              operationsToDelete.forEach((id) => {
                syncStore.delete(id);
                cleanedCount++;
              });
            }

            transaction.oncomplete = () => {
              db.close();
              resolve(cleanedCount);
            };
            transaction.onerror = () => {
              db.close();
              reject(transaction.error);
            };
          })
          .catch((error) => {
            transaction.oncomplete = () => {
              db.close();
              resolve(0);
            };
          });
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Error cleaning up invalid sync operations:', error);
    return 0;
  }
}
