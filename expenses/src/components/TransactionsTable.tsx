import React, { useRef } from 'react';
import { getClassNamesFor, useSortableData } from '../utils/useSortableData';
import useSwipeActions from '../hooks/useSwipeActions';
import { FaPen, FaTrash } from 'react-icons/fa';
import { formatNumber, getCategory } from '../utils/utils';
import { TransactionOrIncomeItem } from '../type/types';

interface TransactionsTableProps {
  items: TransactionOrIncomeItem[];
  isModal?: boolean;
  handleEdit: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  items,
  handleEdit,
  isModal = false,
  setShowDeleteModal,
}) => {
  const { sortedItems, requestSort, sortConfig } = useSortableData(items || []);

  const tableRef = useRef(null);
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
  } = useSwipeActions();

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
            <th>Description</th>
            <th className="desktop-only"></th>
            <th className="desktop-only"></th>
          </tr>
        </thead>
        <tbody ref={tableRef}>
          {sortedItems.map((element) => (
            <tr
              key={element.id}
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
              <td>{getCategory[element.cat]}</td>
              <td>{element.dsc}</td>
              <td className="desktop-only">
                <button
                  onClick={() => handleEdit(element.id)}
                  className="btn-outline"
                >
                  Edit
                </button>
              </td>
              <td className="desktop-only">
                <button
                  onClick={() => setShowDeleteModal(element.id)}
                  className="btn-outline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteVisible && (
        <div style={{ ...extraRowStyle }}>
          <div className="action delete">
            <FaTrash />
          </div>
        </div>
      )}
      {editVisible && (
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
