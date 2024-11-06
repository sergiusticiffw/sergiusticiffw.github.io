import React, { useEffect, useRef } from 'react';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import useSwipeActions from '@hooks/useSwipeActions';
import { FaPen, FaTrash } from 'react-icons/fa';
import { formatNumber, getCategory } from '@utils/utils';
import { TransactionOrIncomeItem } from '@type/types';
import { MdEdit, MdDelete } from 'react-icons/md';
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
        (item) => item.type === 'removed' && item.data.type === 'transaction'
      )
      .map((item) => item.data),
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
    <div className="table-wrapper">
      <table className="expenses-table" cellSpacing="0" cellPadding="0">
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
            <th className="desktop-only"></th>
            <th className="desktop-only"></th>
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
                onTouchStart={(e) => handleTouchStart(e, element.id, tableRef)}
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
                {!isModal ? <td>{element.dt.split('-')[2]}</td> : null}
                <td>{formatNumber(element.sum)}</td>
                <td>
                  <div className="text-with-icon">
                    {getIconForCategory(getCategory[element.cat])}
                    {getCategory[element.cat]}
                  </div>
                </td>
                {!isModal ? <td>{element.dsc}</td> : null}
                <td className="desktop-only">
                  <button
                    onClick={() => handleEdit(element.id)}
                    className="btn-outline"
                  >
                    <MdEdit />
                  </button>
                </td>
                <td className="desktop-only">
                  <button
                    onClick={() => setShowDeleteModal(element.id)}
                    className="btn-outline"
                  >
                    <MdDelete />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {deleteVisible && !isModal && (
        <div style={{ ...extraRowStyle }}>
          <div className="action delete">
            <FaTrash />
          </div>
        </div>
      )}
      {editVisible && !isModal && (
        <div style={{ ...extraRowStyle }}>
          <div className="action edit">
            <FaPen />
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsTable;
