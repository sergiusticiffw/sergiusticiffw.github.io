import React, { useRef, useState } from 'react';
import { formatNumber } from '@shared/utils/utils';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import { useLocalization } from '@shared/context/localization';
import { FiEdit2, FiTrash2, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Link } from '@tanstack/react-router';
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import type { ApiLoan } from '@shared/type/types';
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';

/** `paid`/`total` are null for completed loans, where the paid amount isn't computed on this page. */
export interface LoanAmounts {
  paid: number | null;
  remaining: number;
  total: number | null;
}

interface LoansListProps {
  loans: ApiLoan[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  getStatus: (loan: ApiLoan) => string;
  getStatusText: (status: string) => string;
  getProgress: (loan: ApiLoan) => number;
  getAmounts?: (loan: ApiLoan) => LoanAmounts;
  pendingSyncIds?: Record<string, true>;
}

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

const LoansList: React.FC<LoansListProps> = ({
  loans,
  onEdit,
  onDelete,
  getStatus,
  getStatusText,
  getProgress,
  getAmounts,
  pendingSyncIds,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useLocalization();
  const [completedOpen, setCompletedOpen] = useState(false);
  const isDesktop = isDesktopLayout();

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  const completedLoans = loans.filter(
    (loan) => getStatus(loan) === 'completed'
  );
  const openLoans = [
    ...loans.filter((loan) => getStatus(loan) === 'active'),
    ...loans.filter((loan) => {
      const s = getStatus(loan);
      return s !== 'active' && s !== 'completed';
    }),
  ];
  const showCompleted = completedOpen || openLoans.length === 0;

  const renderLoan = (loan: ApiLoan) => {
    const status = getStatus(loan);
    const statusText = getStatusText(status);
    const statusKey = (status === 'active' || status === 'completed' || status === 'pending') ? status : 'pending';
    const statusStyles = getStatusStyles(statusKey);
    const progressRounded = Math.round(getProgress(loan));
    const amounts = getAmounts?.(loan);

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

        <Link
          to="/expenses/loan/$id"
          params={{ id: String(loan.id) }}
          data-id={loan.id}
          className="bg-app-surface border border-app-subtle rounded-2xl py-4 pr-4 pl-4 flex items-center gap-4 relative z-[1] no-underline cursor-pointer w-full min-h-0 touch-pan-y overflow-hidden transition-all duration-200 hover:bg-app-surface-hover hover:border-[var(--color-border-accent)] active:scale-[0.99] motion-safe"
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
          <div className="flex-1 min-w-0 flex flex-col gap-2 relative z-[1]">
            <div className="flex items-start gap-3 w-full justify-between">
              <div className="text-[0.96rem] font-semibold text-app-primary leading-tight break-words">
                {loan.title ?? ''}
              </div>
              <div
                className="py-0.5 px-2.5 rounded-full text-[0.75rem] font-bold uppercase tracking-wide whitespace-nowrap border bg-transparent shrink-0"
                style={{
                  color: statusStyles.color,
                  borderColor: statusStyles.borderColor,
                }}
              >
                {statusText}
              </div>
            </div>

            <div>
              <p className="m-0 text-micro uppercase tracking-wider text-app-muted">
                {t('loans.principal')}
              </p>
              <div className="text-[1.4rem] font-bold text-app-primary tabular-nums leading-tight">
                {formatNumber(loan.fp ?? '')}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressRounded}
                aria-label={`${loan.title ?? ''} progress`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${progressRounded}%`,
                    backgroundColor: statusStyles.color,
                  }}
                />
              </div>
              <span className="shrink-0 min-w-[2.5rem] text-right text-caption font-semibold tabular-nums text-app-secondary">
                {progressRounded}%
              </span>
            </div>

            {status === 'completed' ? (
              <p
                className="m-0 text-caption font-medium"
                style={{ color: STATUS_COLORS.completed }}
              >
                {t('loans.paidOff')}
              </p>
            ) : (
              amounts && (
                <p className="m-0 text-caption text-app-muted tabular-nums">
                  {t('loans.paid')}{' '}
                  <span className="text-app-secondary font-medium">
                    {formatNumber(amounts.paid ?? 0)}
                  </span>
                  {' · '}
                  {t('loans.remaining')}{' '}
                  <span className="text-app-secondary font-medium">
                    {formatNumber(amounts.remaining)}
                  </span>
                </p>
              )
            )}
            <ItemSyncIndicator status={isPending ? 'pending' : undefined} />
          </div>
          {isDesktop && (
            <div className="shrink-0 flex flex-col gap-2 ml-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(loan.id);
                }}
                className="p-2 rounded-lg text-app-muted/70 bg-black/20 border border-white/10 hover:text-app-primary hover:bg-white/10 hover:border-white/20 transition-colors [&_svg]:text-[1rem]"
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
                className="p-2 rounded-lg text-app-muted/70 bg-black/20 border border-white/10 hover:text-app-primary hover:bg-white/10 hover:border-white/20 transition-colors [&_svg]:text-[1rem]"
                aria-label="Delete"
                title="Delete"
              >
                <FiTrash2 />
              </button>
            </div>
          )}
        </Link>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col gap-2 w-full max-w-full relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y pinch-zoom' }}
      ref={listRef}
    >
      {openLoans.map(renderLoan)}
      {completedLoans.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setCompletedOpen((o) => !o)}
            aria-expanded={showCompleted}
            className="flex items-center justify-between w-full mt-3 py-2 px-1 bg-transparent border-none cursor-pointer text-sm font-semibold text-app-muted hover:text-app-secondary transition-colors [&_svg]:text-base"
          >
            <span>
              {t('loans.completedSection').replace(
                '{count}',
                String(completedLoans.length)
              )}
            </span>
            {showCompleted ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />}
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-2 opacity-70">
              {completedLoans.map(renderLoan)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoansList;
