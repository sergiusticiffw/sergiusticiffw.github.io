import React, { useState, useEffect } from 'react';
import { FiWifi, FiWifiOff, FiLoader } from 'react-icons/fi';
import { useLocalization } from '@context/localization';
import { isOnline, getPendingSyncOperations } from '@utils/indexedDB';
import './SyncStatusIndicator.scss';

const SyncStatusIndicator: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { t } = useLocalization();

  useEffect(() => {
    const checkPending = async () => {
      const pending = await getPendingSyncOperations();
      setPendingCount(pending.length);
    };

    const handleOnline = () => {
      setOnline(true);
      // Check pending when coming online
      checkPending();
    };

    const handleOffline = () => {
      setOnline(false);
      setIsSyncing(false);
      // Still check pending count when offline
      checkPending();
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncEnd = async (event?: CustomEvent) => {
      setIsSyncing(false);
      // Small delay to ensure IndexedDB operations are complete
      await new Promise(resolve => setTimeout(resolve, 200));
      // Refresh pending count after sync
      await checkPending();
    };

    // Initial check
    checkPending();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-start', handleSyncStart);
    window.addEventListener('sync-end', handleSyncEnd);

    // Check pending operations periodically (every 2 seconds)
    const interval = setInterval(checkPending, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-start', handleSyncStart);
      window.removeEventListener('sync-end', handleSyncEnd);
      clearInterval(interval);
    };
  }, []);

  // Don't show if online, no pending operations, and not syncing
  if (online && pendingCount === 0 && !isSyncing) {
    return null;
  }

  // Determine status: offline takes priority, then syncing, then pending count
  const showOffline = !online;
  const showSyncing = online && isSyncing;
  const showPending = online && !isSyncing && pendingCount > 0;
  const showSynced = online && !isSyncing && pendingCount === 0;

  return (
    <div
      className={`sync-status-indicator ${
        showOffline
          ? 'sync-status-indicator--offline'
          : showSyncing
          ? 'sync-status-indicator--syncing'
          : showPending
          ? 'sync-status-indicator--pending'
          : 'sync-status-indicator--success'
      }`}
    >
      {showOffline ? (
        <>
          <FiWifiOff className="sync-status-indicator__icon" />
          <span>{t('offline.message')}</span>
        </>
      ) : showSyncing ? (
        <>
          <FiLoader className="sync-status-indicator__icon sync-status-indicator__icon--spinning" />
          <span>{t('syncStatus.syncing') || 'Syncing...'}</span>
        </>
      ) : showPending ? (
        <>
          <FiWifiOff className="sync-status-indicator__icon" />
          <span>{pendingCount} {t('syncStatus.pending')}</span>
        </>
      ) : (
        <>
          <FiWifi className="sync-status-indicator__icon" />
          <span>{t('syncStatus.synced') || 'Synced'}</span>
        </>
      )}
    </div>
  );
};

export default SyncStatusIndicator;

