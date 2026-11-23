import React, { useState, useMemo, useEffect } from 'react';
import { formatNumber, getLocale } from '@shared/utils/utils';
import { useLocalization } from '@shared/context/localization';
import { useAuthState } from '@shared/context/context';
import VaulDrawer from '@shared/components/VaulDrawer';
import { TransactionsList } from '@shared/components/TransactionsList';
import Month from '@features/expenses/components/Home/Month';
import { TransactionOrIncomeItem } from '@shared/type/types';
import IncomeTable from '@features/incomes/components/Income/IncomeTable';
import { labelToMonthKey } from '@features/expenses/budgets/model';
import { getSession } from '../../../../crypto/encryptionState';
import { getDataProviderKind } from '../../../../data';
import FamilyDaySpendSection from '@features/expenses/components/Charts/FamilyDaySpendSection';
import {
  filterDailyRows,
  partnerDayTotal,
  partnerDaysWithSpend,
} from '@features/expenses/components/Charts/familyTotals';
import {
  clearFamilyDailyTotalsCache,
  useFamilyDailyTotals,
} from '@features/expenses/components/Charts/useFamilyDailyTotals';
import './calendar.css';

/** Calendar day drawer: personal txs + other members' shared category totals. */
interface Transaction {
  id: string;
  dsc: string;
  sum: number | string;
  cat: string;
  dt: string;
}

type AmountTier = 'low' | 'medium' | 'high';

interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

interface DayAgg {
  total: number;
  count: number;
  partnerOnly: boolean;
}

interface CalendarViewProps {
  transactions: Transaction[];
  currentMonth: string;
  variant?: 'expense' | 'income';
  changedItems?: Record<string, unknown>;
  onClearChangedItem?: (id: string) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  pendingSyncIds?: Record<string, true>;
  /** Active page filters, applied to other members' shared spend too. */
  categoryFilter?: string;
  dateRange?: { start: string; end: string } | null;
  /** Text or tag filter is on: aggregates carry no descriptions, so they cannot match. */
  hidePartnerSpend?: boolean;
}

const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 0] as const; // Monday-first

/** Compact amount for tight calendar cells; drawer keeps full formatNumber. */
function formatCalendarAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    return `${n.toFixed(n >= 10 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1000) {
    const n = value / 1000;
    return `${n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  return formatNumber(value);
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseMonthLabel(label: string): { year: number; monthIndex: number } | null {
  const key = labelToMonthKey(label);
  if (key) {
    const [y, m] = key.split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const parts = label.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const year = parseInt(parts[parts.length - 1], 10);
  const monthName = parts.slice(0, -1).join(' ');
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthIndex = months.indexOf(monthName);
  if (!year || monthIndex < 0) return null;
  return { year, monthIndex };
}

function buildMonthCells(year: number, monthIndex: number): DayCell[] {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // getDay(): 0=Sun … 6=Sat → Monday-first offset
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const today = todayKey();
  const cells: DayCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const date = new Date(year, monthIndex, dayNum);
    const key = toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    cells.push({
      key,
      day: date.getDate(),
      inMonth: dayNum >= 1 && dayNum <= daysInMonth,
      isToday: key === today,
    });
  }
  return cells;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  currentMonth,
  variant = 'expense',
  changedItems,
  onClearChangedItem,
  onMonthChange: _onMonthChange,
  onEdit,
  onDelete,
  pendingSyncIds,
  categoryFilter = '',
  dateRange = null,
  hidePartnerSpend = false,
}) => {
  // Month swipe is handled by the parent page (covers Budget Rings + calendar).
  void _onMonthChange;
  const { t, language } = useLocalization();
  const { userDetails } = useAuthState();
  const myUid = String(
    getSession()?.uid ||
      (userDetails &&
      typeof userDetails === 'object' &&
      userDetails.current_user?.uid) ||
      ''
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const monthKey = useMemo(() => {
    if (variant !== 'expense') return null;
    const fromLabel = labelToMonthKey(currentMonth);
    if (fromLabel) return fromLabel;
    const dt = transactions.find((tx) => tx.dt)?.dt;
    return dt && dt.length >= 7 ? dt.slice(0, 7) : null;
  }, [currentMonth, variant, transactions]);

  const familyEnabled =
    variant === 'expense' && getDataProviderKind() === 'supabase';

  useEffect(() => {
    if (familyEnabled) clearFamilyDailyTotalsCache();
  }, [familyEnabled, monthKey]);

  const {
    household,
    rows: memberDailyRows,
    sharedCategoryIds,
    totalsSource,
    loading: familyLoading,
  } = useFamilyDailyTotals(familyEnabled ? monthKey : null);

  const partnerRows = useMemo(
    () =>
      hidePartnerSpend
        ? []
        : filterDailyRows(memberDailyRows, {
            category: categoryFilter,
            dateRange,
          }),
    [hidePartnerSpend, memberDailyRows, categoryFilter, dateRange]
  );

  const partnerDays = useMemo(
    () =>
      familyEnabled ? partnerDaysWithSpend(partnerRows, myUid) : new Set<string>(),
    [familyEnabled, partnerRows, myUid]
  );

  const transactionsByDate = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        const date = transaction.dt;
        if (!acc[date]) acc[date] = [];
        acc[date].push(transaction);
        return acc;
      },
      {} as Record<string, Transaction[]>
    );
  }, [transactions]);

  const dayAggs = useMemo(() => {
    const dates = new Set<string>([
      ...Object.keys(transactionsByDate),
      ...partnerDays,
    ]);
    const map = new Map<string, DayAgg>();
    for (const date of dates) {
      const dayTransactions = transactionsByDate[date] || [];
      const personalTotal = dayTransactions.reduce(
        (sum, tx) =>
          sum +
          (typeof tx.sum === 'string' ? parseFloat(tx.sum) : Number(tx.sum) || 0),
        0
      );
      const othersTotal = familyEnabled
        ? partnerDayTotal(partnerRows, date, myUid)
        : 0;
      if (dayTransactions.length === 0 && othersTotal <= 0) continue;
      const showPersonal = dayTransactions.length > 0;
      map.set(date, {
        total: showPersonal ? personalTotal : othersTotal,
        count: dayTransactions.length,
        partnerOnly: !showPersonal,
      });
    }
    return map;
  }, [
    transactionsByDate,
    partnerDays,
    familyEnabled,
    partnerRows,
    myUid,
  ]);

  const tierThresholds = useMemo(() => {
    const totals = [...dayAggs.values()]
      .filter((agg) => !agg.partnerOnly)
      .map((agg) => agg.total)
      .filter((total) => total > 0)
      .sort((a, b) => a - b);
    if (totals.length < 3) return { low: 1000, high: 3000 };
    const at = (share: number) =>
      totals[Math.min(totals.length - 1, Math.floor(share * totals.length))];
    return { low: at(1 / 3), high: at(2 / 3) };
  }, [dayAggs]);

  const getExpenseTier = (amount: number): AmountTier => {
    if (amount < tierThresholds.low) return 'low';
    if (amount < tierThresholds.high) return 'medium';
    return 'high';
  };

  const monthParts = useMemo(
    () => parseMonthLabel(currentMonth),
    [currentMonth]
  );

  const cells = useMemo(() => {
    if (!monthParts) return [];
    return buildMonthCells(monthParts.year, monthParts.monthIndex);
  }, [monthParts]);

  const weekdayLabels = useMemo(() => {
    const locale = getLocale(language);
    // 2024-01-01 is a Monday — iterate Mon→Sun
    return WEEKDAY_KEYS.map((_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [language]);

  const openDay = (clickedDate: string) => {
    const dayTransactions = transactionsByDate[clickedDate] || [];
    const hasPartner =
      familyEnabled && !!household && partnerDays.has(clickedDate);
    if (dayTransactions.length > 0 || hasPartner) {
      setSelectedDate(clickedDate);
      setShowDayModal(true);
    }
  };

  const selectedDayTransactions = selectedDate
    ? transactionsByDate[selectedDate] || []
    : [];
  const selectedDayTotal = selectedDayTransactions.reduce(
    (sum, tx) =>
      sum +
      (typeof tx.sum === 'string' ? parseFloat(tx.sum) : Number(tx.sum) || 0),
    0
  );

  const showPartnerSection =
    familyEnabled &&
    !hidePartnerSpend &&
    !!household &&
    !!selectedDate &&
    sharedCategoryIds.size > 0;

  const dateLocale = getLocale(language);

  return (
    <div
      className="calendar-view-component w-full relative"
      data-no-month-swipe={showDayModal ? true : undefined}
    >
      <div className="calendar-month-grid" role="grid" aria-label={currentMonth}>
        {weekdayLabels.map((label, i) => (
          <div key={WEEKDAY_KEYS[i]} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const agg = dayAggs.get(cell.key);
          const interactive = !!agg;
          const tier =
            agg && !agg.partnerOnly && variant === 'expense'
              ? getExpenseTier(agg.total)
              : null;
          const dateLabel = new Date(
            `${cell.key}T12:00:00`
          ).toLocaleDateString(dateLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          const txWord =
            agg && agg.count === 1
              ? t('common.transaction')
              : t('common.transactions');
          const ariaLabel = agg
            ? agg.partnerOnly || agg.count <= 0
              ? `${dateLabel}, ${formatNumber(agg.total)}`
              : `${dateLabel}, ${formatNumber(agg.total)}, ${agg.count} ${txWord}`
            : dateLabel;

          const classNames = [
            'calendar-day',
            'calendar-day--heatmap',
            !cell.inMonth ? 'calendar-day--other' : '',
            cell.isToday ? 'calendar-day--today' : '',
            selectedDate === cell.key && showDayModal
              ? 'calendar-day--selected'
              : '',
            interactive ? 'calendar-day--interactive' : '',
            interactive ? 'calendar-day--has-data' : '',
            agg?.partnerOnly ? 'calendar-day--partner' : '',
            variant === 'income' && agg ? 'calendar-day--income' : '',
            tier ? `calendar-day--tier-${tier}` : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className={classNames}
              disabled={!interactive}
              aria-label={ariaLabel}
              aria-current={cell.isToday ? 'date' : undefined}
              onClick={() => {
                if (interactive) openDay(cell.key);
              }}
            >
              <span className="calendar-day-number" aria-hidden>
                {cell.day}
              </span>
              {agg && (
                <span className="calendar-day-meta" aria-hidden>
                  <span className="calendar-day-amount">
                    {formatCalendarAmount(agg.total)}
                  </span>
                  {!agg.partnerOnly && agg.count > 0 && (
                    <span className="calendar-day-count">
                      {agg.count} tx
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {variant === 'expense' && (
        <div className="month-chart-wrapper mt-6 p-0">
          <Month month={currentMonth} />
        </div>
      )}

      <VaulDrawer
        show={showDayModal && !!selectedDate}
        onClose={() => setShowDayModal(false)}
        title={
          selectedDate
            ? (() => {
                const locale = getLocale(language);
                const dateStr = new Date(
                  `${selectedDate}T12:00:00`
                ).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
                const n = selectedDayTransactions.length;
                if (n <= 0) return dateStr;
                const word =
                  n === 1
                    ? t('common.transaction')
                    : t('common.transactions');
                return `${dateStr} · ${n} ${word}`;
              })()
            : ''
        }
        topContent={
          selectedDayTransactions.length > 0 ||
          (selectedDate && dayAggs.get(selectedDate)) ? (
            <>
              {t('common.total')}:{' '}
              <strong>
                {formatNumber(
                  selectedDayTotal ||
                    dayAggs.get(selectedDate!)?.total ||
                    0
                )}
              </strong>
            </>
          ) : undefined
        }
      >
        {variant === 'income' ? (
          <IncomeTable
            items={selectedDayTransactions as TransactionOrIncomeItem[]}
            handleEdit={(id) => {
              setShowDayModal(false);
              onEdit?.(id);
            }}
            setShowDeleteModal={(id) => {
              setShowDayModal(false);
              onDelete?.(id);
            }}
            changedItems={changedItems}
            handleClearChangedItem={onClearChangedItem}
            pendingSyncIds={pendingSyncIds}
            hideDateColumn
            hideDateSortButton
            hideAmountSortButton
            hideTitle
          />
        ) : (
          <>
            {selectedDayTransactions.length > 0 && (
              <TransactionsList
                variant="expense"
                transactions={(
                  selectedDayTransactions as TransactionOrIncomeItem[]
                ).map((tx) => ({
                  id: tx.id,
                  dsc: tx.dsc ?? '',
                  sum: tx.sum,
                  cat: tx.cat,
                  dt: tx.dt,
                }))}
                pendingSyncIds={pendingSyncIds}
                changedItems={changedItems as Record<string, { type?: string }>}
                groupByDay={false}
                hideDateColumn
                hideSort
                onEdit={(id) => {
                  setShowDayModal(false);
                  onEdit?.(id);
                }}
                onDelete={(id) => {
                  setShowDayModal(false);
                  onDelete?.(id);
                }}
              />
            )}
            {showPartnerSection && selectedDate && (
              <FamilyDaySpendSection
                dayKey={selectedDate}
                rows={partnerRows}
                myUid={myUid}
                members={household?.members || []}
                sharedCategoryIds={sharedCategoryIds}
                totalsSource={totalsSource}
                loading={familyLoading}
              />
            )}
          </>
        )}
      </VaulDrawer>
    </div>
  );
};

export default React.memo(CalendarView);
