import React from 'react';
import { FaEdit, FaTrash, FaCalendar, FaTag } from 'react-icons/fa';
import { formatNumber } from '@utils/utils';
import './TransactionCard.scss';

interface TransactionCardProps {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'expense' | 'income' | 'loan';
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  id,
  amount,
  category,
  description,
  date,
  type,
  onEdit,
  onDelete,
}) => {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'income':
        return {
          gradient: 'gradient-success',
          icon: '💰',
          prefix: '+',
        };
      case 'loan':
        return {
          gradient: 'gradient-warning',
          icon: '🏦',
          prefix: '',
        };
      default:
        return {
          gradient: 'gradient-danger',
          icon: '💸',
          prefix: '-',
        };
    }
  };

  const config = getTypeConfig(type);
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={`transaction-card glass-card ${config.gradient} animate-slide-up`}>
      <div className="transaction-header">
        <div className="transaction-icon">
          <span className="icon-emoji">{config.icon}</span>
        </div>
        <div className="transaction-amount">
          <span className="amount-prefix">{config.prefix}</span>
          <span className="amount-value">${formatNumber(amount)}</span>
        </div>
        <div className="transaction-actions">
          {onEdit && (
            <button
              className="action-button edit-button"
              onClick={() => onEdit(id)}
              title="Edit transaction"
            >
              <FaEdit />
            </button>
          )}
          {onDelete && (
            <button
              className="action-button delete-button"
              onClick={() => onDelete(id)}
              title="Delete transaction"
            >
              <FaTrash />
            </button>
          )}
        </div>
      </div>

      <div className="transaction-content">
        <h3 className="transaction-description">{description}</h3>
        
        <div className="transaction-details">
          <div className="detail-item">
            <FaTag className="detail-icon" />
            <span className="detail-label">Category:</span>
            <span className="detail-value">{category}</span>
          </div>
          
          <div className="detail-item">
            <FaCalendar className="detail-icon" />
            <span className="detail-label">Date:</span>
            <span className="detail-value">{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="transaction-footer">
        <div className={`transaction-type-badge ${config.gradient}`}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;