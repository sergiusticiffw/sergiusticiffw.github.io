import React, { useRef, useState } from 'react';
import { getIconForCategory } from '@utils/helper';
import { formatNumber } from '@utils/utils';
import useSwipeActions from '@hooks/useSwipeActions';
import { FaPen, FaTrash, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import './TransactionList.scss';

interface Transaction {
  id: string;
  dsc: string;
  sum: number | string;
  cat: string;
  dt: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  categoryLabels: Array<{ value: string; label: string }>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categoryLabels,
  onEdit,
  onDelete,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();
  
  const getCategoryLabel = (catValue: string) => {
    return categoryLabels.find((cat) => cat.value === catValue)?.label || catValue;
  };
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Sort transactions
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortField) return 0;
    
    if (sortField === 'date') {
      const dateA = new Date(a.dt).getTime();
      const dateB = new Date(b.dt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    if (sortField === 'amount') {
      const amountA = typeof a.sum === 'string' ? parseFloat(a.sum) : a.sum;
      const amountB = typeof b.sum === 'string' ? parseFloat(b.sum) : b.sum;
      return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
    }
    
    return 0;
  });
  
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FaSort />;
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  return (
    <div className="transaction-list-component" ref={listRef}>
      {/* Sort Controls */}
      <div className="sort-controls">
        <button 
          className={`sort-button ${sortField === 'date' ? 'active' : ''}`}
          onClick={() => handleSort('date')}
        >
          Date {getSortIcon('date')}
        </button>
        <button 
          className={`sort-button ${sortField === 'amount' ? 'active' : ''}`}
          onClick={() => handleSort('amount')}
        >
          Amount {getSortIcon('amount')}
        </button>
      </div>
      
      {sortedTransactions.map((transaction) => {
        const categoryLabel = getCategoryLabel(transaction.cat);
        const date = new Date(transaction.dt);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        
        const isThisItemSwiped = swipedItemId === transaction.id;
        
        return (
          <div
            key={transaction.id}
            className="transaction-item-wrapper"
          >
            {/* Swipe Actions - only show for the swiped item */}
            <div className={`swipe-actions-background ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}>
              {isThisItemSwiped && deleteVisible && (
                <div className="delete-action-bg">
                  <FaTrash />
                </div>
              )}
              {isThisItemSwiped && editVisible && (
                <div className="edit-action-bg">
                  <FaPen />
                </div>
              )}
            </div>
            
            <div
              data-id={transaction.id}
              className="transaction-list-item"
              onTouchStart={(e) => handleTouchStart(e, transaction.id, listRef)}
              onTouchMove={(e) => handleTouchMove(e, listRef)}
              onTouchEnd={(e) => 
                handleTouchEnd(
                  e,
                  listRef,
                  transaction.id,
                  onEdit || (() => {}),
                  onDelete || (() => {})
                )
              }
            >
              {/* Date */}
              <div className="transaction-date-box">
                <div className="date-day">{day}</div>
                <div className="date-month">{month}</div>
              </div>
              
              {/* Category Name */}
              <div className="transaction-category-box">
                <div className="category-name">{categoryLabel}</div>
              </div>
              
              {/* Content */}
              <div className="transaction-content">
                <div className="transaction-name">{transaction.dsc}</div>
              </div>
              
              {/* Price */}
              <div className="transaction-price">
                {formatNumber(transaction.sum)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TransactionList;
