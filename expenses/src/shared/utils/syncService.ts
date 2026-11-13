// Sync service - flushes offline queue through the active DataProvider
import {
  getPendingSyncOperations,
  removeSyncOperation,
  updateSyncOperationStatus,
  updateSyncOperationsWithNewId,
  cleanupInvalidSyncOperations,
  isOnline,
  openDB,
  getExpensesFromDB,
  getLoansFromDB,
  getPaymentsFromDB,
  type SyncOperation,
} from '@shared/utils/indexedDB';
import { processDataSync } from '@shared/utils/utils';
import { logger } from '@shared/utils/logger';
import {
  isMigrationActive,
  refreshStatus,
} from '../../crypto/encryptionState';
import { encodeNodeBody } from '../../crypto/nodeCodec';
import { getDataProvider } from '../../data';
import type { DataProvider, WriteResult } from '../../data';

export interface SyncResult {
  success: number;
  failed: number;
}

const resolveServerIdFromUrl = (url: string | undefined): string | null => {
  if (!url || url.includes('temp_')) return null;
  const match = url.match(/\/node\/([^/?]+)/);
  if (match?.[1] && !match[1].startsWith('temp_')) return match[1];
  return null;
};

async function findLocalExpense(localId: string, url?: string) {
  const db = await openDB();
  const transaction = db.transaction('expenses', 'readonly');
  const store = transaction.objectStore('expenses');

  let localItem = await new Promise<any>((resolve) => {
    const req = store.get(localId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  if (!localItem) {
    const fromUrl = resolveServerIdFromUrl(url);
    if (fromUrl) {
      localItem = await new Promise<any>((resolve) => {
        const req = store.get(fromUrl);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    }
  }

  transaction.oncomplete = () => db.close();
  return localItem;
}

async function findLocalLoan(localId: string, url?: string) {
  const db = await openDB();
  const transaction = db.transaction('loans', 'readonly');
  const store = transaction.objectStore('loans');

  let localItem = await new Promise<any>((resolve) => {
    const req = store.get(localId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  if (!localItem) {
    const fromUrl = resolveServerIdFromUrl(url);
    if (fromUrl) {
      localItem = await new Promise<any>((resolve) => {
        const req = store.get(fromUrl);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    }
  }

  transaction.oncomplete = () => db.close();
  return localItem;
}

async function encodeOutgoing(op: SyncOperation): Promise<unknown | null> {
  if (op.type === 'delete' || !op.data) return null;
  const protectedEntity =
    op.entityType === 'expense' ||
    op.entityType === 'income' ||
    op.entityType === 'loan' ||
    op.entityType === 'payment';
  if (!protectedEntity) return op.data;
  const encoded = await encodeNodeBody(op.data);
  if (encoded.kind === 'hold') {
    logger.log(`Holding sync operation ${op.id}: ${encoded.reason}`);
    return undefined;
  }
  return encoded.body;
}

async function runProviderOp(
  provider: DataProvider,
  op: SyncOperation,
  targetId: string | undefined,
  body: unknown | null
): Promise<{ success: boolean; write?: WriteResult; notFound?: boolean }> {
  const isMoney =
    op.entityType === 'expense' || op.entityType === 'income';

  if (op.type === 'create') {
    const result = isMoney
      ? await provider.createTransaction(body)
      : op.entityType === 'loan'
        ? await provider.createLoan(body)
        : await provider.createPayment(body);
    if (!result.success || !result.data) {
      return { success: false };
    }
    return { success: true, write: result.data };
  }

  if (op.type === 'update') {
    if (!targetId || targetId.startsWith('temp_')) {
      return { success: false };
    }
    const result = isMoney
      ? await provider.updateTransaction(targetId, body)
      : op.entityType === 'loan'
        ? await provider.updateLoan(targetId, body)
        : await provider.updatePayment(targetId, body);
    return { success: result.success, write: result.data };
  }

  // delete
  if (!targetId || targetId.startsWith('temp_')) {
    return { success: true, notFound: true };
  }
  const result = isMoney
    ? await provider.deleteTransaction(targetId)
    : op.entityType === 'loan'
      ? await provider.deleteLoan(targetId)
      : await provider.deletePayment(targetId);

  if (!result.success) {
    const msg = result.error?.message || '';
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return { success: true, notFound: true };
    }
    return { success: false };
  }
  return { success: true };
}

async function remapsLocalId(
  op: SyncOperation,
  serverId: string,
  dataDispatch?: any
) {
  if (!op.localId) return;

  try {
    if (op.entityType === 'expense' || op.entityType === 'income') {
      const db = await openDB();
      const transaction = db.transaction('expenses', 'readwrite');
      const store = transaction.objectStore('expenses');
      const localItem = await new Promise<any>((resolve) => {
        const req = store.get(op.localId!);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (localItem) {
        await new Promise<void>((resolve) => {
          const delReq = store.delete(op.localId!);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        });
        localItem.id = serverId;
        await new Promise<void>((resolve) => {
          const putReq = store.put(localItem);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        });
      }
      transaction.oncomplete = () => db.close();
      await updateSyncOperationsWithNewId(
        op.localId!,
        serverId,
        op.entityType
      );
      if (dataDispatch) {
        const updatedData = (await getExpensesFromDB()) || [];
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
      const localItem = await new Promise<any>((resolve) => {
        const req = store.get(op.localId!);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (localItem) {
        await new Promise<void>((resolve) => {
          const delReq = store.delete(op.localId!);
          delReq.onsuccess = () => resolve();
          delReq.onerror = () => resolve();
        });
        localItem.id = serverId;
        await new Promise<void>((resolve) => {
          const putReq = store.put(localItem);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        });
      }
      transaction.oncomplete = () => db.close();
      await updateSyncOperationsWithNewId(
        op.localId!,
        serverId,
        op.entityType
      );
      if (dataDispatch) {
        const loans = (await getLoansFromDB()) || [];
        const payments = (await getPaymentsFromDB()) || [];
        dataDispatch({
          type: 'SET_DATA',
          loans: loans.length > 0 ? loans : null,
          payments,
          loading: false,
        });
      }
    } else if (op.entityType === 'payment' && dataDispatch) {
      const loans = (await getLoansFromDB()) || [];
      const payments = (await getPaymentsFromDB()) || [];
      // Rewrite payment id in local cache when possible
      for (const group of payments) {
        const idx = group.data?.findIndex(
          (p: any) => String(p.id) === String(op.localId)
        );
        if (idx != null && idx >= 0 && group.data) {
          group.data[idx] = { ...group.data[idx], id: serverId };
        }
      }
      dataDispatch({
        type: 'SET_DATA',
        loans: loans.length > 0 ? loans : null,
        payments,
        loading: false,
      });
    }
  } catch (error) {
    logger.error('Error updating local ID after sync:', error);
  }
}

export async function syncPendingOperations(
  token: string,
  dataDispatch?: any
): Promise<SyncResult> {
  if (!isOnline() || isMigrationActive()) {
    return { success: 0, failed: 0 };
  }

  await refreshStatus(true);

  const cleanedCount = await cleanupInvalidSyncOperations();
  if (cleanedCount > 0) {
    logger.log(`Cleaned up ${cleanedCount} invalid sync operations`);
  }

  let pendingOperations = await getPendingSyncOperations();
  if (pendingOperations.length === 0) {
    return { success: 0, failed: 0 };
  }

  const provider = getDataProvider();
  provider.configure(token);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pendingOperations.length; i++) {
    const op = pendingOperations[i];
    if (op.retries && op.retries >= 3) {
      await removeSyncOperation(op.id!);
      failCount++;
      continue;
    }

    try {
      let itemExists = false;
      let targetId = op.localId;

      if (op.localId) {
        if (op.entityType === 'expense' || op.entityType === 'income') {
          const localItem = await findLocalExpense(op.localId, op.url);
          if (localItem) {
            itemExists = true;
            if (localItem.id && !String(localItem.id).startsWith('temp_')) {
              targetId = String(localItem.id);
              op.localId = targetId;
            }
          }
        } else if (op.entityType === 'loan') {
          const localItem = await findLocalLoan(op.localId, op.url);
          if (localItem) {
            itemExists = true;
            if (localItem.id && !String(localItem.id).startsWith('temp_')) {
              targetId = String(localItem.id);
              op.localId = targetId;
            }
          }
        } else if (op.entityType === 'payment') {
          const payments = (await getPaymentsFromDB()) || [];
          itemExists = !!payments.find(
            (p: any) =>
              p.loanId && p.data?.some((pay: any) => pay.id === op.localId)
          );
          const fromUrl = resolveServerIdFromUrl(op.url);
          if (fromUrl) targetId = fromUrl;
        }
      }

      if (op.type === 'update' && !itemExists && op.localId) {
        logger.warn(
          `Skipping sync operation ${op.id}: item ${op.localId} not found in local DB`
        );
        await removeSyncOperation(op.id!);
        successCount++;
        continue;
      }

      if (
        op.type === 'update' &&
        targetId &&
        String(targetId).startsWith('temp_')
      ) {
        if (!itemExists) {
          await removeSyncOperation(op.id!);
          successCount++;
          continue;
        }
      }

      if (
        op.type === 'delete' &&
        targetId &&
        String(targetId).startsWith('temp_')
      ) {
        logger.warn(
          `Skipping delete operation ${op.id}: has temp ID and was never synced`
        );
        await removeSyncOperation(op.id!);
        successCount++;
        continue;
      }

      const body = await encodeOutgoing(op);
      if (body === undefined) {
        // held for encryption
        continue;
      }

      const result = await runProviderOp(provider, op, targetId, body);
      if (!result.success) {
        throw new Error('Sync operation failed');
      }

      if (op.type === 'create' && op.localId && result.write?.id) {
        await remapsLocalId(op, result.write.id, dataDispatch);
        pendingOperations = await getPendingSyncOperations();
      }

      if (
        op.type === 'update' &&
        (op.entityType === 'expense' || op.entityType === 'income') &&
        dataDispatch
      ) {
        const updatedData = (await getExpensesFromDB()) || [];
        const processedData = processDataSync(updatedData);
        dataDispatch({
          type: 'SET_DATA',
          raw: updatedData,
          ...processedData,
          totals: processedData.monthsTotals,
          loading: false,
        });
      }

      if (
        op.type === 'delete' &&
        (op.entityType === 'expense' || op.entityType === 'income') &&
        dataDispatch
      ) {
        const updatedData = (await getExpensesFromDB()) || [];
        const processedData = processDataSync(updatedData);
        dataDispatch({
          type: 'SET_DATA',
          raw: updatedData,
          ...processedData,
          totals: processedData.monthsTotals,
          loading: false,
        });
      }

      if (
        (op.entityType === 'loan' || op.entityType === 'payment') &&
        dataDispatch &&
        op.type !== 'create'
      ) {
        const loans = (await getLoansFromDB()) || [];
        const payments = (await getPaymentsFromDB()) || [];
        dataDispatch({
          type: 'SET_DATA',
          loans: loans.length > 0 ? loans : null,
          payments,
          loading: false,
        });
      }

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

export function setupNetworkListener(
  token: string,
  dataDispatch?: any,
  onSyncStart?: () => void,
  onSyncEnd?: () => void,
  _onItemSynced?: (id: string) => void
): () => void {
  let isSyncing = false;

  const syncHandler = async () => {
    if (isOnline() && !isSyncing) {
      const pending = await getPendingSyncOperations();
      if (pending.length > 0) {
        isSyncing = true;
        if (onSyncStart) onSyncStart();
        window.dispatchEvent(new CustomEvent('sync-start'));
        const result = await syncPendingOperations(token, dataDispatch);
        isSyncing = false;
        window.dispatchEvent(new CustomEvent('sync-end', { detail: result }));
        if (onSyncEnd) onSyncEnd();
        logger.log(
          `Sync complete: ${result.success} succeeded, ${result.failed} failed`
        );
      }
    }
  };

  window.addEventListener('online', syncHandler);
  syncHandler();

  return () => {
    window.removeEventListener('online', syncHandler);
  };
}
