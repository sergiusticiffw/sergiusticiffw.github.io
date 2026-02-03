import React, { useRef, useState } from 'react';
import { formatNumber } from '@shared/utils/utils';
import useSwipeActions from '@shared/hooks/useSwipeActions';
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
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import type { ApiLoan } from '@shared/type/types';

interface LoansListProps {
  loans: ApiLoan[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  getStatus: (loan: ApiLoan) => string;
  getStatusText: (status: string) => string;
  getProgress: (loan: ApiLoan) => number;
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
  const listRef = useRef<HTMLDivElement>(null);
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

    let aValue: string | number, bValue: string | number;

    if (sortField === 'title') {
      aValue = a.title?.toLowerCase() || '';
      bValue = b.title?.toLowerCase() || '';
    } else if (sortField === 'principal') {
      aValue = parseFloat(a.fp || '0');
      bValue = parseFloat(b.fp || '0');
    } else if (sortField === 'status') {
      aValue = statusOrder.indexOf(getStatus(a));
      bValue = statusOrder.indexOf(getStatus(b));
    } else {
      return 0;
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

  const sortBtn =
    'rounded-lg py-2 px-4 text-white/60 text-sm cursor-pointer flex items-center gap-2 transition-all duration-200 bg-white/[0.05] border-none hover:bg-white/10 hover:text-white/80 [&_svg]:text-sm';
  const sortBtnActive =
    'bg-[rgba(91,141,239,0.2)] text-[#5b8def] font-medium';

  return (
    <div
      className="flex flex-col gap-2 w-full max-w-full relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
      ref={listRef}
    >
      {/* Sticky Sort & Filter – same button style as TransactionList */}
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 mb-3 items-center justify-between py-2 px-0 bg-transparent">
        <div className="inline-flex gap-2 items-center">
          <button
            type="button"
            className={`${sortBtn} ${sortField === 'title' ? sortBtnActive : ''}`}
            onClick={() => handleSort('title')}
            aria-label="Sort by title"
          >
            <FiType />
            {sortField === 'title' && getSortIcon('title')}
          </button>
          <button
            type="button"
            className={`${sortBtn} ${sortField === 'principal' ? sortBtnActive : ''}`}
            onClick={() => handleSort('principal')}
            aria-label="Sort by amount"
          >
            <FiHash />
            {sortField === 'principal' && getSortIcon('principal')}
          </button>
          <button
            type="button"
            className={`${sortBtn} ${sortField === 'status' ? sortBtnActive : ''}`}
            onClick={() => handleSort('status')}
            aria-label="Sort by status"
          >
            <FiTag />
            {sortField === 'status' && getSortIcon('status')}
          </button>
        </div>
        <div className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg text-white/60 text-sm bg-white/[0.05] border-none cursor-pointer hover:bg-white/10 hover:text-white/80 [&_svg]:text-sm">
          <FiSliders />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="bg-transparent border-none text-white text-[0.9rem] font-semibold outline-none cursor-pointer pr-1.5"
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
          <div
            key={loan.id}
            className="relative w-full rounded-2xl overflow-hidden"
          >
            <div
              className={`swipe-actions-background rounded-2xl ${isThisItemSwiped && (deleteVisible || editVisible) ? 'visible' : ''}`}
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
              params={{ id: String(loan.id) }}
              data-id={loan.id}
              className="bg-white/[0.05] rounded-2xl py-4 pr-6 pl-4 flex items-stretch gap-4 relative z-[1] no-underline cursor-pointer w-full min-h-0 touch-pan-y overflow-hidden transition-all duration-200 hover:bg-white/10 hover:translate-x-1 active:scale-[0.98]"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pan-x pinch-zoom' }}
              onTouchStart={(e) => handleTouchStart(e as any, loan.id, listRef)}
              onTouchMove={(e) => handleTouchMove(e as any, listRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(e as any, listRef, loan.id, onEdit, onDelete)
              }
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2.5 relative z-[1]">
                <div className="flex items-center gap-3 w-full justify-between">
                  <div className="text-[0.96rem] font-semibold text-[#f5f6f7] leading-tight break-words">
                    {loan.title ?? ''}
                  </div>
                  <div
                    className="py-0.5 px-2.5 rounded-full text-[0.75rem] font-bold uppercase tracking-wide whitespace-nowrap border bg-transparent"
                    style={{
                      color: statusColor,
                      borderColor: `${statusColor}55`,
                    }}
                  >
                    {statusText}
                  </div>
                </div>

                <div className="text-[1.4rem] font-bold text-[#f5f6f7]">
                  {formatNumber(loan.fp ?? '')}
                </div>
                <ItemSyncIndicator status={isPending ? 'pending' : undefined} />

                <div className="flex items-center gap-2.5 w-full">
                  <div className="flex-1 h-1 bg-[#2a2c33] rounded-full overflow-hidden relative">
                    <span
                      className="block h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: statusColor,
                      }}
                    />
                  </div>
                  <div
                    className="text-[0.76rem] font-semibold whitespace-nowrap"
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
