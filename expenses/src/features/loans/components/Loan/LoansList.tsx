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

  const iconBtn =
    'inline-flex items-center justify-center gap-1.5 h-[38px] w-[38px] rounded-[10px] border border-white/[0.08] bg-transparent text-white/75 cursor-pointer transition-all duration-200 text-[0.9rem] [&_svg]:text-base hover:bg-white/[0.07]';
  const iconBtnActive =
    'border-white/[0.18] bg-white/[0.05] text-white';

  return (
    <div
      className="w-full max-w-full relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
      ref={listRef}
    >
      {/* Sort & Filter Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between rounded-xl py-2.5 px-3 bg-[#1b1d21]">
        <div className="inline-flex gap-1.5 items-center">
          <button
            className={`${iconBtn} ${sortField === 'title' ? iconBtnActive : ''}`}
            onClick={() => handleSort('title')}
            aria-label="Sort by title"
          >
            <FiType />
            {sortField === 'title' && getSortIcon('title')}
          </button>
          <button
            className={`${iconBtn} ${sortField === 'principal' ? iconBtnActive : ''}`}
            onClick={() => handleSort('principal')}
            aria-label="Sort by amount"
          >
            <FiHash />
            {sortField === 'principal' && getSortIcon('principal')}
          </button>
          <button
            className={`${iconBtn} ${sortField === 'status' ? iconBtnActive : ''}`}
            onClick={() => handleSort('status')}
            aria-label="Sort by status"
          >
            <FiTag />
            {sortField === 'status' && getSortIcon('status')}
          </button>
        </div>
        <div className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[10px] border border-white/[0.08] text-white/70 bg-white/[0.02] text-[0.9rem] [&_svg]:text-base [&_svg]:opacity-80">
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
            className="relative overflow-hidden rounded-2xl max-w-full w-full [&:not(:last-child)]:mb-3.5"
          >
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
              params={{ id: String(loan.id) }}
              data-id={loan.id}
              className="flex items-stretch gap-4 p-4 bg-[#1e1f23] rounded-xl relative z-[2] transition-all duration-200 no-underline cursor-pointer max-w-full w-full overflow-hidden touch-pan-y overscroll-x-contain hover:bg-[#202126] active:bg-[#23252a]"
              style={{ WebkitOverflowScrolling: 'touch' }}
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
