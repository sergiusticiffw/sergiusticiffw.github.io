import { useEffect, useState, useRef } from 'react';
import { getPendingSyncOperations, SyncOperation } from '@utils/indexedDB';

type EntityType = 'expense' | 'income' | 'loan' | 'payment';

/**
 * Hook to track pending sync IDs for specific entity types
 * 100% event-driven (no polling) - only updates on sync events
 */
export function usePendingSyncIds(
  entityTypes: EntityType[]
): Record<string, true> {
  const [pendingSyncIds, setPendingSyncIds] = useState<Record<string, true>>(
    {}
  );
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    let mounted = true;

    const refreshPending = async () => {
      try {
        const pending = await getPendingSyncOperations();
        const ids: Record<string, true> = {};

        pending.forEach((op: SyncOperation) => {
          if (op.localId && entityTypes.includes(op.entityType)) {
            ids[op.localId] = true;
          }
        });

        // Avoid rerenders if nothing changed
        const nextKey = Object.keys(ids)
          .sort()
          .join('|');
        if (mounted && nextKey !== lastKeyRef.current) {
          lastKeyRef.current = nextKey;
          setPendingSyncIds(ids);
        }
      } catch {
        // ignore errors
      }
    };

    const onSyncEnd = () => {
      // Small delay to let IndexedDB settle
      setTimeout(refreshPending, 200);
    };

    // Initial load
    refreshPending();

    // Event-driven updates (no polling)
    window.addEventListener('sync-start', refreshPending);
    window.addEventListener('sync-end', onSyncEnd);
    window.addEventListener('online', refreshPending);
    window.addEventListener('offline', refreshPending);
    window.addEventListener('sync-queue-changed', refreshPending);

    return () => {
      mounted = false;
      window.removeEventListener('sync-start', refreshPending);
      window.removeEventListener('sync-end', onSyncEnd);
      window.removeEventListener('online', refreshPending);
      window.removeEventListener('offline', refreshPending);
      window.removeEventListener('sync-queue-changed', refreshPending);
    };
  }, [entityTypes.join(',')]); // Only re-run if entityTypes change

  return pendingSyncIds;
}
