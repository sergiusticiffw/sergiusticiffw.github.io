import React, { useEffect, useRef, useState } from 'react';
import useSwipeActions from '@hooks/useSwipeActions';
import { FaPen, FaTrash, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { formatNumber } from '@utils/utils';
import { TransactionOrIncomeItem } from '@type/types';
import './IncomeTable.scss';
import { useLocalization } from '@context/localization';

interface IncomeTableProps {
  items: TransactionOrIncomeItem[];
  handleEdit: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
  changedItems?: any;
  handleClearChangedItem?: any;
}

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

const IncomeTable: React.FC<IncomeTableProps> = ({
  items,
  handleEdit,
  setShowDeleteModal,
  handleClearChangedItem,
  changedItems,
}) => {
  const listRef = useRef<any>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { t } = useLocalization();

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  useEffect(() => {
    Object.keys(changedItems).forEach((id) => {
      const timer = setTimeout(() => {
        handleClearChangedItem(id);
      }, 2000);
      return () => clearTimeout(timer);
    });
  }, [changedItems, handleClearChangedItem]);

  const allItems = [
    ...items,
    ...Object.values(changedItems)
      .filter(
        (item: any) => item.type === 'removed' && item.data.type === 'incomes'
      )
      .map((item: any) => item.data),
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort items
  const sortedItems = [...allItems].sort((a, b) => {
    if (!sortField) {
      // Default sort by date descending
      return new Date(b.dt).getTime() - new Date(a.dt).getTime();
    }

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
    <div className="income-list-component" ref={listRef}>
      {/* Header with Sort Controls */}
      <div className="income-list-header">
        <h3 className="income-list-title">{t('income.incomeRecords')}</h3>

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
      </div>

      {/* Income List */}
      <div className="income-list-items">
        {sortedItems.map((income) => {
          const changeType = changedItems[income.id]?.type;
          const date = new Date(income.dt);
          const day = date.getDate();
          const month = date
            .toLocaleDateString('en-US', { month: 'short' })
            .toUpperCase();
          const year = date.getFullYear();

          const isThisItemSwiped = swipedItemId === income.id;

          return (
            <div
              key={income.id}
              className={`income-item-wrapper ${changeType || ''}`}
            >
              {/* Swipe Actions Background */}
              <div
                className={`swipe-actions-background ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
              >
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

              {/* Income Item */}
              <div
                data-id={income.id}
                className="income-list-item"
                onTouchStart={(e) => handleTouchStart(e, income.id, listRef)}
                onTouchMove={(e) => handleTouchMove(e, listRef)}
                onTouchEnd={(e) =>
                  handleTouchEnd(
                    e,
                    listRef,
                    income.id,
                    handleEdit,
                    setShowDeleteModal
                  )
                }
              >
                {/* Date Box */}
                <div className="income-date-box">
                  <div className="date-day">{day}</div>
                  <div className="date-month">{month}</div>
                  <div className="date-year">{year}</div>
                </div>

                {/* Content */}
                <div className="income-content">
                  <div className="income-description">{income.dsc}</div>
                </div>

                {/* Amount */}
                <div className="income-amount">{formatNumber(income.sum)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IncomeTable;
