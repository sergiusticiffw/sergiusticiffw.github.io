import React, { useRef, useState } from 'react';
import { formatNumber } from '@utils/utils';
import useSwipeActions from '@hooks/useSwipeActions';
import {
  FaPen,
  FaTrash,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './LoansList.scss';

interface Loan {
  id: string;
  title: string;
  fp: string; // principal
  fls: string; // status
}

interface LoansListProps {
  loans: Loan[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  getStatus: (loan: Loan) => string;
  getStatusText: (status: string) => string;
}

type SortField = 'title' | 'principal' | 'status' | null;
type SortDirection = 'asc' | 'desc';

const LoansList: React.FC<LoansListProps> = ({
  loans,
  onEdit,
  onDelete,
  getStatus,
  getStatusText,
}) => {
  const listRef = useRef<any>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort loans
  const sortedLoans = [...loans].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any, bValue: any;

    if (sortField === 'title') {
      aValue = a.title?.toLowerCase() || '';
      bValue = b.title?.toLowerCase() || '';
    } else if (sortField === 'principal') {
      aValue = parseFloat(a.fp || '0');
      bValue = parseFloat(b.fp || '0');
    } else if (sortField === 'status') {
      aValue = getStatus(a);
      bValue = getStatus(b);
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FaSort />;
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4caf50';
      case 'active':
        return '#5B8DEF';
      case 'pending':
        return '#ff9800';
      default:
        return 'rgba(255, 255, 255, 0.6)';
    }
  };

  return (
    <div className="loans-list-component" ref={listRef}>
      {/* Sort Controls */}
      <div className="sort-controls">
        <button
          className={`sort-button ${sortField === 'title' ? 'active' : ''}`}
          onClick={() => handleSort('title')}
        >
          Title {getSortIcon('title')}
        </button>
        <button
          className={`sort-button ${sortField === 'principal' ? 'active' : ''}`}
          onClick={() => handleSort('principal')}
        >
          Amount {getSortIcon('principal')}
        </button>
        <button
          className={`sort-button ${sortField === 'status' ? 'active' : ''}`}
          onClick={() => handleSort('status')}
        >
          Status {getSortIcon('status')}
        </button>
      </div>

      {sortedLoans.map((loan) => {
        const status = getStatus(loan);
        const statusText = getStatusText(status);
        const statusColor = getStatusColor(status);

        const isThisItemSwiped = swipedItemId === loan.id;

        return (
          <div key={loan.id} className="loan-item-wrapper">
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

            <Link
              to={`/expenses/loan/${loan.id}`}
              data-id={loan.id}
              className="loan-list-item"
              onTouchStart={(e) => handleTouchStart(e, loan.id, listRef)}
              onTouchMove={(e) => handleTouchMove(e, listRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(e, listRef, loan.id, onEdit, onDelete)
              }
            >
              {/* Content */}
              <div className="loan-content">
                <div className="loan-title">{loan.title}</div>
                <div className="loan-amount">{formatNumber(loan.fp)}</div>
              </div>

              {/* Status */}
              <div className="loan-status" style={{ color: statusColor }}>
                {statusText}
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default LoansList;
