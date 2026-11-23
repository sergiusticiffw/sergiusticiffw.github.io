import React, { useRef, useState } from 'react';
import { FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import { useLocalization } from '@shared/context/localization';
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';
import { formatNumber } from '@shared/utils/utils';
import {
  Contribution,
  MonthContributionGroup,
  formatContributionMonth,
} from '../model';

/** Months shown at first, and added by each "Load more". */
const MONTHS_PAGE = 3;

interface ContributionHistoryProps {
  groups: MonthContributionGroup[];
  monthNames: string[];
  currency: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const ContributionHistory = ({
  groups,
  monthNames,
  currency,
  onEdit,
  onDelete,
}: ContributionHistoryProps) => {
  const { t } = useLocalization();
  const listRef = useRef<HTMLDivElement>(null);
  const isDesktop = isDesktopLayout();
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PAGE);
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  if (groups.length === 0) {
    return (
      <p className="m-0 px-4 py-3 text-sm text-app-muted">
        {t('goals.historyEmpty')}
      </p>
    );
  }

  return (
    <div
      ref={listRef}
      className="relative overflow-x-hidden overflow-y-auto touch-pan-y"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {groups.slice(0, visibleMonths).map((group, groupIndex, visible) => (
        <div key={group.month}>
          <div
            className={`flex items-baseline justify-between gap-3 px-4 py-2.5 ${
              groupIndex > 0 ? 'border-t border-white/10' : ''
            }`}
          >
            <p className="m-0 text-sm font-semibold text-app-primary">
              {formatContributionMonth(group.month, monthNames)}
            </p>
            <p className="m-0 text-caption text-app-muted">
              {t('goals.historyMonthTotal')}{' '}
              <span
                className={`font-semibold tabular-nums ${
                  group.total < 0
                    ? 'text-[color-mix(in_srgb,var(--color-expense)_85%,white)]'
                    : 'text-app-secondary'
                }`}
              >
                {formatNumber(group.total)} {currency}
              </span>
            </p>
          </div>
          <ul className="m-0 list-none p-0">
            {group.entries.map((entry: Contribution, entryIndex, list) => {
              const isThisItemSwiped = swipedItemId === entry.id;
              const isLastEntry =
                entryIndex === list.length - 1 &&
                groupIndex === visible.length - 1;
              return (
                <li key={entry.id} className="relative overflow-hidden">
                  {!isDesktop && (
                    <div
                      data-swipe-actions
                      className={`absolute inset-0 z-[1] flex items-center justify-between opacity-0 transition-opacity duration-200 pointer-events-none ${
                        isThisItemSwiped && (deleteVisible || editVisible)
                          ? 'opacity-100'
                          : ''
                      }`}
                    >
                      {isThisItemSwiped && deleteVisible && (
                        <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_12px_rgba(239,68,68,0.4)] [&_svg]:text-[1.1rem]">
                          <FiTrash2 />
                        </div>
                      )}
                      {isThisItemSwiped && editVisible && (
                        <div className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-white shadow-[0_2px_12px_var(--color-app-accent-shadow)] [&_svg]:text-[1.1rem]">
                          <FiEdit2 />
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    data-id={entry.id}
                    className={`relative z-[1] flex w-full items-center justify-between gap-3 px-4 py-3 text-sm transition-colors ${
                      !isLastEntry ? 'border-b border-white/[0.04]' : ''
                    }`}
                    style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
                    onTouchStart={
                      !isDesktop
                        ? (e) => handleTouchStart(e, entry.id, listRef)
                        : undefined
                    }
                    onTouchMove={
                      !isDesktop
                        ? (e) => handleTouchMove(e, listRef)
                        : undefined
                    }
                    onTouchEnd={
                      !isDesktop
                        ? (e) =>
                            handleTouchEnd(
                              e,
                              listRef,
                              entry.id,
                              onEdit,
                              onDelete
                            )
                        : undefined
                    }
                  >
                    <span className="tabular-nums text-app-muted">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold tabular-nums ${
                          entry.amount < 0
                            ? 'text-[color-mix(in_srgb,var(--color-expense)_85%,white)]'
                            : 'text-app-primary'
                        }`}
                      >
                        {entry.amount > 0 ? '+' : ''}
                        {formatNumber(entry.amount)} {currency}
                      </span>
                      {isDesktop && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onEdit(entry.id)}
                            className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 [&_svg]:text-[0.95rem]"
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(entry.id)}
                            className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white/80 [&_svg]:text-[0.95rem]"
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {groups.length > visibleMonths && (
        <div className="flex items-center justify-center border-t border-white/10 py-3">
          <button
            type="button"
            onClick={() => setVisibleMonths(visibleMonths + MONTHS_PAGE)}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 text-sm font-medium text-white/55 hover:text-[var(--color-app-accent)]"
          >
            <FiChevronDown className="size-3.5" aria-hidden />
            <span>
              {t('common.loadMore')} ({groups.length - visibleMonths}{' '}
              {t('common.remaining')})
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ContributionHistory;
