import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';

interface ItemSyncIndicatorProps {
  status?: 'pending' | 'synced' | 'failed';
}

const ItemSyncIndicator: React.FC<ItemSyncIndicatorProps> = ({ status }) => {
  if (!status) return null;

  const title =
    status === 'pending'
      ? 'Pending sync'
      : status === 'failed'
        ? 'Sync failed'
        : 'Synced';

  const colorClass =
    status === 'pending'
      ? 'text-amber-500'
      : status === 'failed'
        ? 'text-red-500'
        : 'text-green-500';

  return (
    <div
      className={`inline-flex items-center justify-center ml-2 shrink-0 w-[14px] h-[14px] ${colorClass}`}
      title={title}
    >
      {status === 'pending' ? (
        <FiClock size={14} />
      ) : status === 'failed' ? (
        <FiAlertCircle size={14} />
      ) : (
        <FiCheckCircle size={14} />
      )}
    </div>
  );
};

export default ItemSyncIndicator;
