// Sync service - handles synchronization of offline operations
import {
  getPendingSyncOperations,
  removeSyncOperation,
  updateSyncOperationStatus,
  updateSyncOperationsWithNewId,
  cleanupInvalidSyncOperations,
  isOnline,
  openDB,
  getExpensesFromDB,
  saveExpensesToDB,
  getLoansFromDB,
  saveLoansToDB,
  getPaymentsFromDB,
  savePaymentsToDB,
  SyncOperation,
} from './indexedDB';
import { API_BASE_URL, createAuthenticatedFetchOptions, processDataSync, fetchLoans } from './utils';
import { TransactionOrIncomeItem } from '@type/types';
import { logger } from './logger';
import { retryWithBackoff, retryPresets } from './retry';

export interface SyncResult {
  success: number;
  failed: number;
}

// Sync pending operations with server
export async function syncPendingOperations(
  token: string,
  dataDispatch?: any
): Promise<SyncResult> {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  // Clean up invalid operations first
  const cleanedCount = await cleanupInvalidSyncOperations();
  if (cleanedCount > 0) {
    logger.log(`Cleaned up ${cleanedCount} invalid sync operations`);
  }

  let pendingOperations = await getPendingSyncOperations();
  if (pendingOperations.length === 0) {
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failCount = 0;

  // Process operations, but re-fetch pending operations after each create
  // to get updated localIds for subsequent operations
  for (let i = 0; i < pendingOperations.length; i++) {
    const op = pendingOperations[i];
    // Skip operations that exceeded max retries
    if (op.retries && op.retries >= 3) {
      await removeSyncOperation(op.id!);
      failCount++;
      continue;
    }

    try {
      // Check if item exists in local DB before syncing
      let syncUrl = op.url;
      let itemExists = false;
      
      if (op.localId) {
        if (op.entityType === 'expense' || op.entityType === 'income') {
          const db = await openDB();
          const transaction = db.transaction('expenses', 'readonly');
          const store = transaction.objectStore('expenses');
          
          // First try to find item with current localId
          let localItem = await new Promise<any>((resolve) => {
            const req = store.get(op.localId!);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          });
          
          // If not found and URL contains server ID (was updated by updateSyncOperationsWithNewId),
          // try to find item with that server ID
          if (!localItem && op.type === 'update' && syncUrl && !syncUrl.includes('temp_') && syncUrl.includes('/node/')) {
            const urlMatch = syncUrl.match(/\/node\/([^?]+)/);
            if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('temp_')) {
              const serverId = urlMatch[1];
              localItem = await new Promise<any>((resolve) => {
                const req = store.get(serverId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
              });
              if (localItem) {
                op.localId = serverId;
                itemExists = true;
              }
            }
          }
          
          transaction.oncomplete = () => db.close();
          
          if (localItem) {
            itemExists = true;
            // If item has server ID (not temp), update URL
            if (localItem.id && !localItem.id.startsWith('temp_')) {
              // Reconstruct URL with server ID instead of replacing (safer)
              syncUrl = `${API_BASE_URL}/node/${localItem.id}?_format=json`;
              op.localId = localItem.id;
            }
          }
        } else if (op.entityType === 'loan') {
          const db = await openDB();
          const transaction = db.transaction('loans', 'readonly');
          const store = transaction.objectStore('loans');
          
          // First try to find item with current localId
          let localItem = await new Promise<any>((resolve) => {
            const req = store.get(op.localId!);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          });
          
          // If not found and URL contains server ID (was updated by updateSyncOperationsWithNewId),
          // try to find item with that server ID
          if (!localItem && op.type === 'update' && syncUrl && !syncUrl.includes('temp_') && syncUrl.includes('/node/')) {
            const urlMatch = syncUrl.match(/\/node\/([^?]+)/);
            if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('temp_')) {
              const serverId = urlMatch[1];
              localItem = await new Promise<any>((resolve) => {
                const req = store.get(serverId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
              });
              if (localItem) {
                op.localId = serverId;
                itemExists = true;
              }
            }
          }
          
          transaction.oncomplete = () => db.close();
          
          if (localItem) {
            itemExists = true;
            if (localItem.id && !localItem.id.startsWith('temp_')) {
              // Reconstruct URL with server ID instead of replacing (safer)
              syncUrl = `${API_BASE_URL}/node/${localItem.id}?_format=json`;
              op.localId = localItem.id;
            }
          }
        } else if (op.entityType === 'payment') {
          // For payments, check if they exist in payments store
          const payments = await getPaymentsFromDB() || [];
          const paymentData = payments.find((p: any) => p.loanId && p.data?.some((pay: any) => pay.id === op.localId));
          itemExists = !!paymentData;
        }
      }

      // For update operations, skip if item doesn't exist in local DB
      // For delete operations, item might not exist (we deleted it locally), so allow sync
      if (op.type === 'update' && !itemExists && op.localId) {
        logger.warn(`Skipping sync operation ${op.id}: item ${op.localId} not found in local DB`);
        await removeSyncOperation(op.id!);
        successCount++; // Count as success since we're cleaning up invalid operations
        continue;
      }

      // For create operations, ensure URL doesn't contain temp ID in path
      if (op.type === 'create') {
        // Always use base create URL for create operations
        if (syncUrl.includes('/node/temp_') || syncUrl.includes(`/node/${op.localId}`)) {
          syncUrl = `${API_BASE_URL}/node?_format=json`;
        }
      } else if (op.type === 'update') {
        // For update, ensure URL doesn't contain temp ID and item exists
        if (syncUrl.includes('/node/temp_') || (op.localId && op.localId.startsWith('temp_'))) {
          if (!itemExists) {
            // Item doesn't exist - skip this operation
            logger.warn(`Skipping sync operation ${op.id}: URL contains temp ID and item not found`);
            await removeSyncOperation(op.id!);
            successCount++;
            continue;
          }
          // Item exists, reconstruct URL with server ID
          if (op.localId && !op.localId.startsWith('temp_')) {
            syncUrl = `${API_BASE_URL}/node/${op.localId}?_format=json`;
          }
        } else if (op.localId && !syncUrl.includes(op.localId)) {
          // Ensure URL is properly constructed with the correct ID
          syncUrl = `${API_BASE_URL}/node/${op.localId}?_format=json`;
        }
      } else if (op.type === 'delete') {
        // For delete operations, item might not exist (we deleted it locally)
        // But we need to ensure URL has server ID, not temp ID
        if (syncUrl.includes('/node/temp_') || (op.localId && op.localId.startsWith('temp_'))) {
          // If URL contains temp ID, try to find the server ID from local DB
          // For delete, if item was deleted locally, we might not find it
          // In this case, skip this operation (item was never synced to server)
          logger.warn(`Skipping delete operation ${op.id}: has temp ID and item not found in local DB`);
          await removeSyncOperation(op.id!);
          successCount++; // Count as success since item was never on server
          continue;
        }
        // Ensure URL is properly constructed
        if (op.localId && !syncUrl.includes(op.localId)) {
          syncUrl = `${API_BASE_URL}/node/${op.localId}?_format=json`;
        }
      }

      const fetchOptions = createAuthenticatedFetchOptions(token, op.method);
      const body = op.data ? JSON.stringify(op.data) : undefined;
      
      // Use retry logic for sync operations
      const retryResult = await retryWithBackoff(
        async () => {
          const response = await fetch(syncUrl, { ...fetchOptions, body });
          
          // For DELETE operations, 404 is acceptable (item already deleted or doesn't exist)
          if (!response.ok && !(op.type === 'delete' && response.status === 404)) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          return response;
        },
        {
          ...retryPresets.sync,
          onRetry: (attempt, error) => {
            logger.warn(`Retrying sync operation ${op.id} (attempt ${attempt}):`, error);
          },
        }
      );

      if (!retryResult.success) {
        throw retryResult.error || new Error('Sync operation failed after retries');
      }

      const response = retryResult.data!;

      // If DELETE returns 404, treat as success
      if (op.type === 'delete' && response.status === 404) {
        logger.log(`Delete operation ${op.id}: item not found (404), treating as success`);
        // Remove from sync queue and continue
        await removeSyncOperation(op.id!);
        successCount++;
        continue;
      }

      // Handle empty responses (e.g., DELETE operations with 204 No Content)
      const contentType = response.headers.get('content-type');
      const hasJsonContent = contentType && contentType.includes('application/json');
      const text = await response.text();
      
      let result: any = null;
      if (hasJsonContent && text.trim()) {
        try {
          result = JSON.parse(text);
        } catch (e) {
          // If JSON parsing fails, log but don't throw for DELETE operations
          if (op.type === 'delete') {
            logger.warn(`Non-JSON response for delete operation ${op.id}, treating as success`);
            result = null;
          } else {
            throw new Error(`Invalid JSON response: ${e}`);
          }
        }
      } else if (op.type === 'delete' && (response.status === 204 || !text.trim())) {
        // DELETE operations may return empty response - that's OK
        result = null;
      } else if (!text.trim()) {
        // Empty response for non-DELETE operations
        result = null;
      }

      // Handle successful creation: update local item with server ID
      if (op.type === 'create' && op.localId && result && result.nid) {
        const serverId = result.nid[0]?.value?.toString() || result.nid.toString();
        
        try {
          if (op.entityType === 'expense' || op.entityType === 'income') {
            const db = await openDB();
            const transaction = db.transaction('expenses', 'readwrite');
            const store = transaction.objectStore('expenses');
            
            // Get local item with temp ID
            const localItem = await new Promise<any>((resolve) => {
              const req = store.get(op.localId!);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });

            if (localItem) {
              // Delete old item with temp ID
              await new Promise<void>((resolve) => {
                const delReq = store.delete(op.localId!);
                delReq.onsuccess = () => resolve();
                delReq.onerror = () => resolve();
              });
              
              // Add new item with server ID
              localItem.id = serverId;
              await new Promise<void>((resolve) => {
                const putReq = store.put(localItem);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => resolve();
              });
            }
            transaction.oncomplete = () => db.close();
            
            // Update pending operations that reference this temp ID
            await updateSyncOperationsWithNewId(op.localId!, serverId, op.entityType);
            
            // Re-fetch pending operations to get updated localIds for subsequent operations
            pendingOperations = await getPendingSyncOperations();
            
            // Update UI if dataDispatch is available
            if (dataDispatch) {
              const updatedData = await getExpensesFromDB() || [];
              const processedData = processDataSync(updatedData);
              
              dataDispatch({
                type: 'SET_DATA',
                raw: updatedData,
                ...processedData,
                totals: processedData.monthsTotals,
                loading: false,
              });
            }
          } else if (op.entityType === 'loan') {
            const db = await openDB();
            const transaction = db.transaction('loans', 'readwrite');
            const store = transaction.objectStore('loans');
            
            // Get local item with temp ID
            const localItem = await new Promise<any>((resolve) => {
              const req = store.get(op.localId!);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null);
            });

            if (localItem) {
              // Delete old item with temp ID
              await new Promise<void>((resolve) => {
                const delReq = store.delete(op.localId!);
                delReq.onsuccess = () => resolve();
                delReq.onerror = () => resolve();
              });
              
              // Add new item with server ID
              localItem.id = serverId;
              await new Promise<void>((resolve) => {
                const putReq = store.put(localItem);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => resolve();
              });
            }
            transaction.oncomplete = () => db.close();
            
            // Update pending operations that reference this temp ID
            await updateSyncOperationsWithNewId(op.localId!, serverId, op.entityType);
            
            // Reload loans from server to get updated data
            if (dataDispatch) {
              // We'll need to pass dispatch from context
              // For now, just reload from IndexedDB
              const loans = await getLoansFromDB() || [];
              const payments = await getPaymentsFromDB() || [];
              
              dataDispatch({
                type: 'SET_DATA',
                loans: loans.length > 0 ? loans : null,
                payments,
                loading: false,
              });
            }
          } else if (op.entityType === 'payment') {
            // For payments, we need to reload from server since they're nested
            // The payment ID update will be handled when we reload loans
            if (dataDispatch) {
              const loans = await getLoansFromDB() || [];
              const payments = await getPaymentsFromDB() || [];
              
              dataDispatch({
                type: 'SET_DATA',
                loans: loans.length > 0 ? loans : null,
                payments,
                loading: false,
              });
            }
          }
        } catch (error) {
          logger.error('Error updating local ID after sync:', error);
        }
      }
      
      // For update operations on expenses/income, update local data after sync
      if (op.type === 'update' && (op.entityType === 'expense' || op.entityType === 'income') && dataDispatch) {
        const updatedData = await getExpensesFromDB() || [];
        const processedData = processDataSync(updatedData);
        
        dataDispatch({
          type: 'SET_DATA',
          raw: updatedData,
          ...processedData,
          totals: processedData.monthsTotals,
          loading: false,
        });
      }
      
      // For delete operations on expenses/income, update local data after sync
      if (op.type === 'delete' && (op.entityType === 'expense' || op.entityType === 'income') && dataDispatch) {
        const updatedData = await getExpensesFromDB() || [];
        const processedData = processDataSync(updatedData);
        
        dataDispatch({
          type: 'SET_DATA',
          raw: updatedData,
          ...processedData,
          totals: processedData.monthsTotals,
          loading: false,
        });
      }
      
      // For update/delete operations on loans/payments, reload from server
      if ((op.entityType === 'loan' || op.entityType === 'payment') && dataDispatch) {
        const loans = await getLoansFromDB() || [];
        const payments = await getPaymentsFromDB() || [];
        
        dataDispatch({
          type: 'SET_DATA',
          loans: loans.length > 0 ? loans : null,
          payments,
          loading: false,
        });
      }

      // Remove from sync queue on success
      await removeSyncOperation(op.id!);
      successCount++;
    } catch (error) {
      logger.error(`Sync failed for operation ${op.id}:`, error);
      await updateSyncOperationStatus(op.id!, 'pending', (op.retries || 0) + 1);
      failCount++;
    }
  }

  return { success: successCount, failed: failCount };
}

// Setup network listener for auto-sync
export function setupNetworkListener(
  token: string,
  dataDispatch?: any,
  onSyncStart?: () => void,
  onSyncEnd?: () => void,
  onItemSynced?: (id: string) => void
): () => void {
  let isSyncing = false;
  
  const syncHandler = async () => {
    if (isOnline() && !isSyncing) {
      const pending = await getPendingSyncOperations();
      if (pending.length > 0) {
        isSyncing = true;
        if (onSyncStart) onSyncStart();
        
        // Trigger custom event for UI updates
        window.dispatchEvent(new CustomEvent('sync-start'));
        
        const result = await syncPendingOperations(token, dataDispatch);
        
        isSyncing = false;
        
        // Trigger custom event for UI updates BEFORE calling onSyncEnd
        // This ensures the indicator updates immediately
        window.dispatchEvent(new CustomEvent('sync-end', { detail: result }));
        
        if (onSyncEnd) onSyncEnd();
        
        logger.log(`Sync complete: ${result.success} succeeded, ${result.failed} failed`);
      }
    }
  };

  // Listen for online event
  window.addEventListener('online', syncHandler);
  
  // Also try to sync immediately if already online
  syncHandler();

  // Return cleanup function
  return () => {
    window.removeEventListener('online', syncHandler);
  };
}

