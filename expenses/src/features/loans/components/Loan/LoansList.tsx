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
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';

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
  const isDesktop = isDesktopLayout();
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

  const sortBtn =
    'rounded-lg py-2 px-4 text-app-muted text-sm cursor-pointer flex items-center gap-2 transition-all duration-200 bg-app-surface border-none hover:bg-app-surface-hover hover:text-app-secondary [&_svg]:text-sm';
  const sortBtnActive =
    'bg-[color-mix(in_srgb,var(--color-app-accent)_20%,transparent)] text-[var(--color-app-accent)] font-medium';

  /* Culori fixe pentru status loan – nu se schimbă cu tema */
  const STATUS_COLORS = {
    active: '#4F8CFF',
    completed: '#22c55e',
    pending: '#94a3b8',
  } as const;

  const getStatusStyles = (key: string) => {
    const color = STATUS_COLORS[key as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.pending;
    return {
      color,
      borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
      backgroundColor: color,
    };
  };

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
        <div className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg text-app-muted text-sm bg-app-surface border-none cursor-pointer hover:bg-app-surface-hover hover:text-app-secondary [&_svg]:text-sm">
          <FiSliders />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            aria-label="Filter by status"
            className="bg-transparent border-none text-app-primary text-[0.9rem] font-semibold outline-none cursor-pointer pr-1.5"
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
        const statusKey = (status === 'active' || status === 'completed' || status === 'pending') ? status : 'pending';
        const statusStyles = getStatusStyles(statusKey);
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
            {!isDesktop && (
              <div
                data-swipe-actions
                className={`absolute inset-0 flex items-center justify-between pointer-events-none z-[1] rounded-2xl opacity-0 transition-opacity duration-200 ${isThisItemSwiped && (deleteVisible || editVisible) ? 'opacity-100' : ''}`}
              >
                {isThisItemSwiped && deleteVisible && (
                  <div className="absolute left-5 w-[50px] h-[50px] rounded-full flex items-center justify-center text-white text-lg bg-gradient-to-br from-red-500 to-red-600 shadow-[0_2px_12px_rgba(239,68,68,0.4)] transition-transform duration-300 [&_svg]:text-[1.25rem] [&_svg]:text-white">
                    <FiTrash2 />
                  </div>
                )}
                {isThisItemSwiped && editVisible && (
                  <div className="absolute right-5 w-[50px] h-[50px] rounded-full flex items-center justify-center text-white text-lg bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] shadow-[0_2px_12px_var(--color-app-accent-shadow)] transition-transform duration-300 [&_svg]:text-[1.25rem] [&_svg]:text-white">
                    <FiEdit2 />
                  </div>
                )}
              </div>
            )}

            {isDesktop && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[3] flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(loan.id);
                  }}
                  className="p-1.5 rounded-md text-app-muted/70 hover:text-app-primary hover:bg-white/10 transition-colors [&_svg]:text-[0.95rem]"
                  aria-label="Edit"
                  title="Edit"
                >
                  <FiEdit2 />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(loan.id);
                  }}
                  className="p-1.5 rounded-md text-app-muted/70 hover:text-app-primary hover:bg-white/10 transition-colors [&_svg]:text-[0.95rem]"
                  aria-label="Delete"
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              </div>
            )}

            <Link
              to="/expenses/loan/$id"
              params={{ id: String(loan.id) }}
              data-id={loan.id}
              className="bg-app-surface rounded-2xl py-4 pr-6 pl-4 flex items-stretch gap-4 relative z-[1] no-underline cursor-pointer w-full min-h-0 touch-pan-y overflow-hidden transition-all duration-200 hover:bg-app-surface-hover hover:translate-x-1 active:scale-[0.98]"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pan-x pinch-zoom' }}
              onTouchStart={
                !isDesktop
                  ? (e) => handleTouchStart(e as any, loan.id, listRef)
                  : undefined
              }
              onTouchMove={
                !isDesktop ? (e) => handleTouchMove(e as any, listRef) : undefined
              }
              onTouchEnd={
                !isDesktop
                  ? (e) => handleTouchEnd(e as any, listRef, loan.id, onEdit, onDelete)
                  : undefined
              }
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2.5 relative z-[1]">
                <div className="flex items-center gap-3 w-full justify-between">
                  <div className="text-[0.96rem] font-semibold text-app-primary leading-tight break-words">
                    {loan.title ?? ''}
                  </div>
                  <div
                    className="py-0.5 px-2.5 rounded-full text-[0.75rem] font-bold uppercase tracking-wide whitespace-nowrap border bg-transparent"
                    style={{
                      color: statusStyles.color,
                      borderColor: statusStyles.borderColor,
                    }}
                  >
                    {statusText}
                  </div>
                </div>

                <div className="text-[1.4rem] font-bold text-app-primary">
                  {formatNumber(loan.fp ?? '')}
                </div>
                <ItemSyncIndicator status={isPending ? 'pending' : undefined} />

                <div className="flex items-center gap-2.5 w-full">
                  <div className="flex-1 h-1 bg-app-surface rounded-full overflow-hidden relative">
                    <span
                      className="block h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: statusStyles.backgroundColor,
                      }}
                    />
                  </div>
                  <div
                    className="text-[0.76rem] font-semibold whitespace-nowrap"
                    style={{ color: statusStyles.color }}
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
