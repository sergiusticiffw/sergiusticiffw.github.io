import React, { useState, useEffect } from 'react';
import { FiWifi, FiWifiOff, FiLoader } from 'react-icons/fi';
import { useLocalization } from '@shared/context/localization';
import { getPendingSyncOperations } from '@shared/utils/indexedDB';

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
      await new Promise((resolve) => setTimeout(resolve, 200));
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

  const baseClasses =
    'flex items-center gap-2.5 py-1.5 px-4 rounded-xl text-xs font-medium transition-all duration-300 fixed top-5 right-5 z-[1030] backdrop-blur-[10px] shadow-md animate-[slideIn_0.3s_ease-out]';
  const stateClasses = showOffline
    ? 'bg-red-500/15 border border-red-500/30 text-red-300'
    : showSyncing
      ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
      : showPending
        ? 'bg-amber-400/15 border border-amber-400/30 text-amber-300'
        : 'bg-green-500/15 border border-green-500/30 text-green-300 animate-[slideIn_0.3s_ease-out,slideOut_0.3s_ease-in_2.7s_forwards]';

  return (
    <div className={`${baseClasses} ${stateClasses}`}>
      {showOffline ? (
        <>
          <FiWifiOff className="shrink-0 w-4 h-4 [stroke-width:2.5]" />
          <span className="whitespace-nowrap leading-snug">{t('offline.message')}</span>
        </>
      ) : showSyncing ? (
        <>
          <FiLoader className="shrink-0 w-4 h-4 [stroke-width:2.5] animate-spin" />
          <span className="whitespace-nowrap leading-snug">{t('syncStatus.syncing') || 'Syncing...'}</span>
        </>
      ) : showPending ? (
        <>
          <FiWifiOff className="shrink-0 w-4 h-4 [stroke-width:2.5]" />
          <span className="whitespace-nowrap leading-snug">
            {pendingCount} {t('syncStatus.pending')}
          </span>
        </>
      ) : (
        <>
          <FiWifi className="shrink-0 w-4 h-4 [stroke-width:2.5]" />
          <span className="whitespace-nowrap leading-snug">{t('syncStatus.synced') || 'Synced'}</span>
        </>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
