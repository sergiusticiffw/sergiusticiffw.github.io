import React from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import './ItemSyncIndicator.scss';

interface ItemSyncIndicatorProps {
  show: boolean;
}

const ItemSyncIndicator: React.FC<ItemSyncIndicatorProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="item-sync-indicator">
      <FiCheckCircle size={14} />
    </div>
  );
};

export default ItemSyncIndicator;
