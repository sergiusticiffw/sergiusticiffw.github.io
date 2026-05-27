import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatNumber,
  getLocale,
  getSuggestionTranslationKey,
} from '@shared/utils/utils';
import { useLocalization } from '@shared/context/localization';
import { getSuggestions, incomeSuggestions } from '@shared/utils/constants';
import { normalizeTag } from '@shared/hooks/useTags';
import TagDisplay from '@shared/components/Common/TagDisplay';
import useSwipeActions from '@shared/hooks/useSwipeActions';
import ItemSyncIndicator from '@shared/components/Common/ItemSyncIndicator';
import { isDesktopLayout } from '@shared/utils/isDesktopLayout';
import {
  useShowCategoryIcons,
  useCompactListDensity,
} from '@stores/settingsStore';
import { CategoryIcon, cn } from '@shared/ui';
import {
  FiEdit2,
  FiTrash2,
  FiMove,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';

export interface TransactionRow {
  id: string;
  dsc: string;
  sum: number | string;
  cat?: string;
  dt: string;
  simulated?: boolean;
}

export interface TransactionsListProps {
  variant?: 'expense' | 'income' | 'payment';
  transactions: TransactionRow[];
  categoryLabels?: Array<{ value: string; label: string }>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  pendingSyncIds?: Record<string, true>;
  groupByDay?: boolean;
  /** Hides the left day/month block inside each row (used when groupByDay=false, e.g. calendar popup). */
  hideDateColumn?: boolean;
  /** Hides the sticky date header that appears when groupByDay=true. */
  hideDateHeader?: boolean;
  changedItems?: Record<string, { type?: string }>;
  hideSort?: boolean;
  initialSortField?: 'date' | 'amount';
  initialSortDirection?: 'asc' | 'desc';
}

type SortField = 'date' | 'amount' | null;
type SortDirection = 'asc' | 'desc';

function TransactionsList({
  variant = 'expense',
  transactions,
  categoryLabels = [],
  onEdit,
  onDelete,
  pendingSyncIds,
  groupByDay = true,
  hideDateColumn = false,
  hideDateHeader = false,
  changedItems = {},
  hideSort = false,
  initialSortField = null,
  initialSortDirection = 'desc',
}: TransactionsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const { language, t } = useLocalization();
  const isDesktop = isDesktopLayout();
  const showCategoryIcons = useShowCategoryIcons();
  const compact = useCompactListDensity();

  // Keep internal sort state aligned with prop-driven defaults (optional).
  useEffect(() => {
    setSortField(initialSortField);
  }, [initialSortField]);

  useEffect(() => {
    setSortDirection(initialSortDirection);
  }, [initialSortDirection]);

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    swipedItemId,
  } = useSwipeActions();

  const getCategoryLabel = (catValue?: string) =>
    categoryLabels.find((cat) => cat.value === catValue)?.label || catValue || '';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (!sortField) return 0;
      if (sortField === 'date') {
        const dateA = new Date(a.dt).getTime();
        const dateB = new Date(b.dt).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      const amountA = typeof a.sum === 'string' ? parseFloat(a.sum) : a.sum;
      const amountB = typeof b.sum === 'string' ? parseFloat(b.sum) : b.sum;
      return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
    });
  }, [transactions, sortField, sortDirection]);

  const grouped = useMemo(() => {
    if (!groupByDay) return { '': sortedTransactions };
    const map: Record<string, TransactionRow[]> = {};
    for (const tx of sortedTransactions) {
      const key = tx.dt;
      if (!map[key]) map[key] = [];
      map[key].push(tx);
    }
    return map;
  }, [sortedTransactions, groupByDay]);

  const dayTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [dayKey, rows] of Object.entries(grouped)) {
      totals[dayKey] = rows.reduce((acc, row) => {
        const v = typeof row.sum === 'string' ? parseFloat(row.sum) : row.sum;
        return acc + (Number.isFinite(v) ? Number(v) : 0);
      }, 0);
    }
    return totals;
  }, [grouped]);

  const sortedGrouped = useMemo(() => {
    if (!groupByDay || sortField !== 'amount') return grouped;
    const next: Record<string, TransactionRow[]> = {};
    for (const [dayKey, rows] of Object.entries(grouped)) {
      next[dayKey] = [...rows].sort((a, b) => {
        const av = typeof a.sum === 'string' ? parseFloat(a.sum) : a.sum;
        const bv = typeof b.sum === 'string' ? parseFloat(b.sum) : b.sum;
        const aNum = Number.isFinite(av) ? Number(av) : 0;
        const bNum = Number.isFinite(bv) ? Number(bv) : 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      });
    }
    return next;
  }, [groupByDay, sortField, sortDirection, grouped]);

  const dayKeys = useMemo(() => {
    const keys = Object.keys(sortedGrouped);
    if (!groupByDay) return keys;

    if (sortField === 'date') {
      return keys.sort((a, b) =>
        sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      );
    }

    if (sortField === 'amount') {
      return keys.sort((a, b) => {
        const at = dayTotals[a] ?? 0;
        const bt = dayTotals[b] ?? 0;
        return sortDirection === 'asc' ? at - bt : bt - at;
      });
    }

    // Default: newest day first
    return keys.sort((a, b) => b.localeCompare(a));
  }, [groupByDay, sortField, sortDirection, sortedGrouped, dayTotals]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <FiMove aria-hidden />;
    return sortDirection === 'asc' ? (
      <FiArrowUp aria-hidden />
    ) : (
      <FiArrowDown aria-hidden />
    );
  };

  const sortBtnBase =
    'inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-caption transition-colors duration-150 motion-safe border bg-app-surface border-app-subtle hover:bg-app-surface-hover [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:shrink-0';
  const sortBtnActive =
    'bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] text-[var(--color-app-accent)] border-[var(--color-border-accent)] font-medium';
  const sortBtnInactive = 'text-app-muted hover:text-app-secondary';

  const desktopActionBtn =
    'p-1.5 rounded-md text-app-muted/70 hover:text-app-primary hover:bg-app-surface-hover transition-colors [&_svg]:w-4 [&_svg]:h-4';

  const renderRow = (transaction: TransactionRow) => {
    const categoryLabel = getCategoryLabel(transaction.cat);
    const date = new Date(transaction.dt);
    const day = date.getDate();
    const locale = getLocale(language);
    const month = date
      .toLocaleDateString(locale, { month: 'short' })
      .toUpperCase();

    const isThisItemSwiped = swipedItemId === transaction.id;
    const isPending =
      !!pendingSyncIds?.[transaction.id] ||
      (typeof transaction.id === 'string' && transaction.id.startsWith('temp_'));
    const changeType = changedItems[transaction.id]?.type;

    const amountClass =
      variant === 'income'
        ? 'text-[var(--color-income)]'
        : 'text-app-primary';

    const amountPrefix =
      variant === 'expense' ? '−' : variant === 'income' ? '+' : null;

    return (
      <div
        key={transaction.id}
        className={cn(
          'relative w-full rounded-2xl overflow-hidden',
          transaction.simulated && 'border-l-4 border-l-[#ff9800]',
          changeType === 'new' &&
            'animate-[slideIn_var(--duration-base)_ease-out] motion-safe',
          changeType === 'removed' &&
            'animate-[slideOut_var(--duration-base)_ease-out] opacity-50 motion-safe'
        )}
      >
        {!isDesktop && (onEdit || onDelete) && (
          <div
            data-swipe-actions
            className={cn(
              'absolute inset-0 flex items-center justify-between pointer-events-none z-[1] rounded-2xl opacity-0 transition-opacity duration-200',
              isThisItemSwiped &&
                (deleteVisible || editVisible) &&
                'opacity-100'
            )}
            aria-hidden
          >
            {isThisItemSwiped && deleteVisible && (
              <div className="absolute left-4 w-11 h-11 rounded-full flex items-center justify-center bg-[var(--color-error)] shadow-lg [&_svg]:w-5 [&_svg]:h-5">
                <FiTrash2 className="text-white" />
              </div>
            )}
            {isThisItemSwiped && editVisible && (
              <div className="absolute right-4 w-11 h-11 rounded-full flex items-center justify-center bg-[var(--color-app-accent)] shadow-lg [&_svg]:w-5 [&_svg]:h-5">
                <FiEdit2 className="text-white" />
              </div>
            )}
          </div>
        )}

        <div
          data-id={transaction.id}
          className={cn(
            'bg-app-surface border border-white/8 rounded-2xl flex items-center gap-3 cursor-pointer transition-all duration-200 relative z-[1] w-full touch-pan-y',
            'shadow-[0_8px_28px_rgba(0,0,0,0.28)]',
            'hover:bg-app-surface-hover hover:border-[var(--color-border-accent)] hover:shadow-[0_10px_32px_rgba(0,0,0,0.34)] active:scale-[0.99] motion-safe',
            compact ? 'p-2.5' : 'p-3 sm:p-4'
          )}
          style={{ touchAction: 'pan-y pan-x pinch-zoom' }}
          onTouchStart={
            !isDesktop
              ? (e) => handleTouchStart(e, transaction.id, listRef)
              : undefined
          }
          onTouchMove={
            !isDesktop ? (e) => handleTouchMove(e, listRef) : undefined
          }
          onTouchEnd={
            !isDesktop
              ? (e) =>
                  handleTouchEnd(
                    e,
                    listRef,
                    transaction.id,
                    onEdit || (() => {}),
                    onDelete || (() => {})
                  )
              : undefined
          }
        >
          {!groupByDay && !hideDateColumn && (
            <div className="flex flex-col items-center justify-center min-w-[38px] shrink-0">
              <div className="text-[1.05rem] font-bold tabular-nums text-app-primary leading-none">
                {day}
              </div>
              <div className="text-micro text-app-muted mt-0.5">{month}</div>
            </div>
          )}

          {variant === 'expense' && showCategoryIcons && (
            <CategoryIcon
              categoryId={transaction.cat}
              size={compact ? 'sm' : 'md'}
            />
          )}

          <div className="flex-1 min-w-0">
            {variant === 'payment' ? (
              <div className="flex items-center gap-2 flex-wrap text-[0.9375rem] sm:text-body text-app-primary leading-tight break-words">
                <span>{transaction.dsc}</span>
                {transaction.simulated && (
                  <span className="inline-block text-[0.7rem] font-semibold text-[#ff9800] bg-[rgba(255,152,0,0.15)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {t('payment.simulated')}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'text-[0.9375rem] sm:text-body text-app-primary leading-tight break-words',
                    compact ? 'line-clamp-1' : 'line-clamp-2'
                  )}
                >
                  <TagDisplay
                    description={transaction.dsc || ''}
                    suggestions={
                      variant === 'income'
                        ? incomeSuggestions
                        : (() => {
                            const suggestions = getSuggestions();
                            return (
                              suggestions[
                                transaction.cat as keyof typeof suggestions
                              ] || []
                            );
                          })()
                    }
                    normalizeTag={
                      variant === 'income' ? undefined : normalizeTag
                    }
                    getTagLabel={(suggestion) => {
                      if (variant === 'income') {
                        const key = `income.tags.${suggestion}`;
                        const translated = t(key);
                        return translated !== key ? translated : suggestion;
                      }
                      const translationKey = getSuggestionTranslationKey(
                        suggestion,
                        transaction.cat
                      );
                      const translated = t(translationKey);
                      return translated !== translationKey
                        ? translated
                        : suggestion;
                    }}
                  />
                </div>
                {variant === 'expense' && !showCategoryIcons && categoryLabel && (
                  <p
                    className={cn(
                      'text-app-muted m-0 mt-0.5 truncate',
                      compact ? 'text-[0.72rem] leading-4' : 'text-micro',
                      'normal-case tracking-normal'
                    )}
                  >
                    {categoryLabel}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div
              className={cn(
                'font-bold tabular-nums whitespace-nowrap flex items-center gap-1',
                compact ? 'text-[0.92rem]' : 'text-[0.95rem] sm:text-base',
                amountClass
              )}
            >
              {amountPrefix != null && (
                <span aria-hidden>{amountPrefix}</span>
              )}
              {formatNumber(transaction.sum)}
              {isPending && <ItemSyncIndicator status="pending" />}
            </div>
          </div>

          {isDesktop && (onEdit || onDelete) && (
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <button
                  type="button"
                  className={desktopActionBtn}
                  aria-label={t('common.edit')}
                  title={t('common.edit')}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(transaction.id);
                  }}
                >
                  <FiEdit2 />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={desktopActionBtn}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(transaction.id);
                  }}
                >
                  <FiTrash2 />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col gap-2 w-full relative overflow-x-hidden"
      ref={listRef}
    >
      {!hideSort && (
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            className={cn(
              sortBtnBase,
              sortField === 'date' ? sortBtnActive : sortBtnInactive
            )}
            onClick={() => handleSort('date')}
            aria-pressed={sortField === 'date'}
          >
            {t('common.date')} {getSortIcon('date')}
          </button>
          <button
            type="button"
            className={cn(
              sortBtnBase,
              sortField === 'amount' ? sortBtnActive : sortBtnInactive
            )}
            onClick={() => handleSort('amount')}
            aria-pressed={sortField === 'amount'}
          >
            {t('common.amount')} {getSortIcon('amount')}
          </button>
        </div>
      )}

      {dayKeys.map((dayKey) => (
        <div key={dayKey || 'all'} className="mb-3">
          {groupByDay && dayKey && !hideDateHeader && (
            <h3 className="text-micro text-app-muted mb-1.5 px-1 sticky top-0 bg-[var(--color-app-bg)]/95 py-1 z-[2] backdrop-blur-sm">
              {new Date(dayKey + 'T12:00:00').toLocaleDateString(
                getLocale(language),
                { weekday: 'long', day: 'numeric', month: 'long' }
              )}
            </h3>
          )}
          <div className="flex flex-col gap-1.5">
            {(sortedGrouped[dayKey] ?? []).map(renderRow)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(TransactionsList);
