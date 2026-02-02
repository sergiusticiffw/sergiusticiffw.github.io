import React, { useRef, useState } from 'react';
import { formatNumber } from '@utils/utils';
import useSwipeActions from '@hooks/useSwipeActions';
import {
  FiEdit2,
  FiTrash2,
  FiMove,
  FiArrowUp,
  FiArrowDown,
  FiType,
  FiHash,
  FiTag,
  FiSliders,
} from 'react-icons/fi';
import { Link } from '@tanstack/react-router';
import ItemSyncIndicator from '@components/Common/ItemSyncIndicator';
import './LoansList.scss';

interface Loan {
  id: string;
  title: string;
  fp: string; // principal
  fls: string; // status
  sdt?: string; // start date
  edt?: string; // end date
  fr?: string; // rate
  fif?: string; // initial fee
  pdt?: string; // first payment date
  frpd?: string; // recurring payment day
}

interface LoansListProps {
  loans: Loan[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  getStatus: (loan: Loan) => string;
  getStatusText: (status: string) => string;
  getProgress: (loan: Loan) => number;
  statusFilter?: string;
  onStatusFilterChange?: (filter: string) => void;
  pendingSyncIds?: Record<string, true>;
}

type SortField = 'title' | 'principal' | 'status' | null;
type SortDirection = 'asc' | 'desc';
const statusOrder = ['active', 'pending', 'completed'];

const LoansList: React.FC<LoansListProps> = ({
  loans,
  onEdit,
  onDelete,
  getStatus,
  getStatusText,
  getProgress,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  pendingSyncIds,
}) => {
  const listRef = useRef<any>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Use external filter if provided, otherwise use internal state
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>('all');
  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : internalStatusFilter;
  
  const handleStatusFilterChange = (filter: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(filter);
    } else {
      setInternalStatusFilter(filter);
    }
  };

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

  const filteredLoans = loans.filter((loan) =>
    statusFilter === 'all' ? true : getStatus(loan) === statusFilter
  );

  // Sort loans
  const sortedLoans = [...filteredLoans].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any, bValue: any;

    if (sortField === 'title') {
      aValue = a.title?.toLowerCase() || '';
      bValue = b.title?.toLowerCase() || '';
    } else if (sortField === 'principal') {
      aValue = parseFloat(a.fp || '0');
      bValue = parseFloat(b.fp || '0');
    } else if (sortField === 'status') {
      aValue = statusOrder.indexOf(getStatus(a));
      bValue = statusOrder.indexOf(getStatus(b));
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove />;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'active':
        return '#4F8CFF';
      case 'pending':
        return '#FFB020';
      default:
        return 'rgba(255, 255, 255, 0.6)';
    }
  };

  return (
    <div className="loans-list-component" ref={listRef}>
      {/* Sort & Filter Controls */}
      <div className="sort-controls compact">
        <div className="sort-buttons">
          <button
            className={`icon-button ${sortField === 'title' ? 'active' : ''}`}
            onClick={() => handleSort('title')}
            aria-label="Sort by title"
          >
            <FiType />
            {sortField === 'title' && getSortIcon('title')}
          </button>
          <button
            className={`icon-button ${sortField === 'principal' ? 'active' : ''}`}
            onClick={() => handleSort('principal')}
            aria-label="Sort by amount"
          >
            <FiHash />
            {sortField === 'principal' && getSortIcon('principal')}
          </button>
          <button
            className={`icon-button ${sortField === 'status' ? 'active' : ''}`}
            onClick={() => handleSort('status')}
            aria-label="Sort by status"
          >
            <FiTag />
            {sortField === 'status' && getSortIcon('status')}
          </button>
        </div>
        <div className="status-filter">
          <FiSliders />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {sortedLoans.map((loan) => {
        const status = getStatus(loan);
        const statusText = getStatusText(status);
        const statusColor = getStatusColor(status);
        const progress = getProgress(loan);

        const isThisItemSwiped = swipedItemId === loan.id;
        const isPending =
          !!pendingSyncIds?.[loan.id] ||
          (typeof loan.id === 'string' && loan.id.startsWith('temp_'));

        return (
          <div key={loan.id} className="loan-item-wrapper">
            {/* Swipe Actions Background */}
            <div
              className={`swipe-actions-background ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
            >
              {isThisItemSwiped && deleteVisible && (
                <div className="delete-action-bg">
                  <FiTrash2 />
                </div>
              )}
              {isThisItemSwiped && editVisible && (
                <div className="edit-action-bg">
                  <FiEdit2 />
                </div>
              )}
            </div>

            <Link
              to="/expenses/loan/$id"
              params={{ id: loan.id }}
              data-id={loan.id}
              className="loan-list-item"
              onTouchStart={(e) => handleTouchStart(e as any, loan.id, listRef)}
              onTouchMove={(e) => handleTouchMove(e as any, listRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(e as any, listRef, loan.id, onEdit, onDelete)
              }
            >
              <div className="loan-content">
                <div className="loan-header-row">
                  <div className="loan-title">{loan.title}</div>
                  <div
                    className="loan-status-chip"
                    style={{
                      color: statusColor,
                      borderColor: `${statusColor}55`,
                    }}
                  >
                    {statusText}
                  </div>
                </div>

                <div className="loan-amount">{formatNumber(loan.fp)}</div>
              <ItemSyncIndicator status={isPending ? 'pending' : undefined} />

                <div className="loan-progress-row">
                  <div className="loan-progress-bar">
                    <span
                      className="loan-progress-fill"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: statusColor,
                      }}
                    />
                  </div>
                  <div
                    className="loan-progress-percentage"
                    style={{ color: statusColor }}
                  >
                    {Math.round(progress)}%
                  </div>
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default LoansList;
