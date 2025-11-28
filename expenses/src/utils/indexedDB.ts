// IndexedDB utilities for caching expense data
const DB_NAME = 'expensesDB';
const DB_VERSION = 2; // Incremented for new stores
const STORE_EXPENSES = 'expenses';
const STORE_LOANS = 'loans';
const STORE_PAYMENTS = 'payments';

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
    };
  });
}

// Save expense data to IndexedDB
export async function saveExpensesToDB(
  data: any[]
): Promise<void> {
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
    console.error('Error saving expenses to IndexedDB:', error);
  }
}

// Sort expenses consistently (by created timestamp if available, otherwise by date)
function sortExpenses(data: any[]): any[] {
  return data.sort((a, b) => {
    // If both have created timestamp, use it
    if (a.cr && b.cr) {
      return b.cr - a.cr; // Descending order (newest first)
    }
    // Otherwise sort by date
    const dateA = new Date(a.dt).getTime();
    const dateB = new Date(b.dt).getTime();
    return dateB - dateA; // Descending order (newest first)
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
    console.error('Error reading expenses from IndexedDB:', error);
    return null;
  }
}

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
    console.error('Error saving loans to IndexedDB:', error);
  }
}

// Get loans data from IndexedDB
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
        resolve(data.length > 0 ? data : null);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error reading loans from IndexedDB:', error);
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
    console.error('Error saving payments to IndexedDB:', error);
  }
}

// Get payments data from IndexedDB
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
        resolve(data.length > 0 ? data : null);
      };
      request.onerror = () => {
        transaction.oncomplete = () => db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error reading payments from IndexedDB:', error);
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
    console.error('Error clearing IndexedDB:', error);
  }
}

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

