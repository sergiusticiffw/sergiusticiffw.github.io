import React, { useEffect, useRef } from 'react';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import useSwipeActions from '@hooks/useSwipeActions';
import { FaPen, FaTrash } from 'react-icons/fa';
import { formatNumber, getCategory } from '@utils/utils';
import { TransactionOrIncomeItem } from '@type/types';
import { getIconForCategory } from '@utils/helper';

interface TransactionsTableProps {
  items: TransactionOrIncomeItem[];
  isModal?: boolean;
  handleEdit: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
  changedItems?: any;
  handleClearChangedItem?: any;
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  items,
  handleEdit,
  isModal = false,
  setShowDeleteModal,
  handleClearChangedItem,
  changedItems,
}) => {
  const tableRef = useRef(null);
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
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
        (item: any) =>
          item.type === 'removed' && item.data.type === 'transaction'
      )
      .map((item: any) => item.data),
  ].sort((a, b) => {
    // First, compare by 'dt'
    const dateComparison = new Date(b.dt).getTime() - new Date(a.dt).getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }
    // If 'dt' values are equal, compare by 'created'
    return b.cr - a.cr;
  });
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    allItems || []
  );

  return (
    <div className="income-table-container">
      <div className="table-wrapper">
        <table className="income-table" cellSpacing="0" cellPadding="0">
          <thead>
            <tr>
              {!isModal ? <th>Date</th> : null}
              <th
                onClick={() => requestSort('sum')}
                className={`sortable ${getClassNamesFor(sortConfig, 'sum')}`}
              >
                Amount
              </th>
              <th>Category</th>
              {!isModal ? <th>Description</th> : null}
              <th className="desktop-only">Actions</th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {sortedItems.map((element) => {
              const changeType = changedItems[element.id]?.type;
              return (
                <tr
                  key={element.id}
                  className={`transaction-item ${changeType || ''}`}
                  data-id={element.id}
                  onTouchStart={(e) =>
                    handleTouchStart(e, element.id, tableRef)
                  }
                  onTouchMove={(e) => handleTouchMove(e, tableRef)}
                  onTouchEnd={(e) =>
                    handleTouchEnd(
                      e,
                      tableRef,
                      element.id,
                      handleEdit,
                      setShowDeleteModal
                    )
                  }
                >
                  {!isModal ? (
                    <td className="income-date">
                      <div className="date-content">
                        <div className="date-day">
                          {new Date(element.dt).getDate()}
                        </div>
                        <div className="date-month">
                          {new Date(element.dt).toLocaleDateString('en-US', {
                            month: 'short',
                          })}
                        </div>
                      </div>
                    </td>
                  ) : null}
                  <td className="income-amount">
                    <div className="amount-value">
                      {formatNumber(element.sum)}
                    </div>
                  </td>
                  <td>{getIconForCategory(getCategory[element.cat])}</td>
                  {!isModal ? (
                    <td className="income-description">
                      <div className="description-text">{element.dsc}</div>
                    </td>
                  ) : null}
                  <td className="desktop-only income-actions-cell">
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(element.id)}
                        className="btn-edit"
                        title="Edit Income"
                      >
                        <FaPen />
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(element.id)}
                        className="btn-delete"
                        title="Delete Income"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {deleteVisible && !isModal && (
          <div style={{ ...extraRowStyle }}>
            <div className="row-action delete">
              <FaTrash />
            </div>
          </div>
        )}
        {editVisible && !isModal && (
          <div style={{ ...extraRowStyle }}>
            <div className="row-action edit">
              <FaPen />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsTable;
