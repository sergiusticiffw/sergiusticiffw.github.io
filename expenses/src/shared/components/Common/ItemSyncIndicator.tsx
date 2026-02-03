import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';
import './ItemSyncIndicator.scss';

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

  return (
    <div
      className={`item-sync-indicator item-sync-indicator--${status}`}
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
