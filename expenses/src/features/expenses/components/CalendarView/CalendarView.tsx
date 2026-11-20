import React, { useState, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import roLocale from '@fullcalendar/core/locales/ro';
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

/** Calendar day drawer: personal txs + other members' shared category totals. */
interface Transaction {
  id: string;
  dsc: string;
  sum: number | string;
  cat: string;
  dt: string;
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
  // Prefer live session uid so partner filter matches RPC user_id.
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
    // Fallback: first personal tx date in the loaded set.
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

  // Other members' rows that match the page filters (category, date range).
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

  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        const date = transaction.dt;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(transaction);
        return acc;
      },
      {} as Record<string, Transaction[]>
    );
  }, [transactions]);

  const events = useMemo(() => {
    const dates = new Set<string>([
      ...Object.keys(transactionsByDate),
      ...partnerDays,
    ]);
    return [...dates]
      .map((date) => {
        const dayTransactions = transactionsByDate[date] || [];
        const personalTotal = dayTransactions.reduce(
          (sum, tx) =>
            sum +
            (typeof tx.sum === 'string'
              ? parseFloat(tx.sum)
              : Number(tx.sum) || 0),
          0
        );
        const othersTotal = familyEnabled
          ? partnerDayTotal(partnerRows, date, myUid)
          : 0;
        if (dayTransactions.length === 0 && othersTotal <= 0) return null;
        const showPersonal = dayTransactions.length > 0;
        return {
          id: date,
          date,
          title: `${formatNumber(showPersonal ? personalTotal : othersTotal)}`,
          allDay: true,
          extendedProps: {
            total: showPersonal ? personalTotal : othersTotal,
            count: dayTransactions.length,
            partnerOnly: !showPersonal,
          },
        };
      })
      .filter((event): event is NonNullable<typeof event> => !!event);
  }, [
    transactionsByDate,
    partnerDays,
    familyEnabled,
    partnerRows,
    myUid,
  ]);

  type AmountTier = 'amount-low' | 'amount-medium' | 'amount-high';

  // Colour bands are relative to this month: the lowest third of personal
  // spending days is green, the highest third red. Fixed 1000/3000 bands
  // only apply when the month has too few days to rank.
  const tierThresholds = useMemo(() => {
    const totals = events
      .filter((event) => !event.extendedProps.partnerOnly)
      .map((event) => event.extendedProps.total)
      .filter((total) => total > 0)
      .sort((a, b) => a - b);
    if (totals.length < 3) return { low: 1000, high: 3000 };
    const at = (share: number) =>
      totals[Math.min(totals.length - 1, Math.floor(share * totals.length))];
    return { low: at(1 / 3), high: at(2 / 3) };
  }, [events]);

  const getExpenseTier = (amount: number): AmountTier => {
    if (amount < tierThresholds.low) return 'amount-low';
    if (amount < tierThresholds.high) return 'amount-medium';
    return 'amount-high';
  };

  const getEventColorClasses = (tier: AmountTier): string => {
    if (tier === 'amount-low') return 'bg-green-500/90 text-white';
    if (tier === 'amount-medium') return 'bg-amber-400/90 text-stone-900';
    return 'bg-red-600/90 text-white';
  };

  const getMonthIndex = (monthName: string) => {
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
    return months.indexOf(monthName);
  };

  const openDay = (clickedDate: string) => {
    const dayTransactions = transactionsByDate[clickedDate] || [];
    const hasPartner =
      familyEnabled && !!household && partnerDays.has(clickedDate);
    if (dayTransactions.length > 0 || hasPartner) {
      setSelectedDate(clickedDate);
      setShowDayModal(true);
    }
  };

  const handleEventClick = (event: { event: { id?: string } }) => {
    const clickedDate = event.event.id;
    if (clickedDate) openDay(clickedDate);
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

  return (
    <div
      className="calendar-view-component w-full relative"
      data-no-month-swipe={showDayModal ? true : undefined}
    >
      <FullCalendar
        key={currentMonth}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={
          currentMonth
            ? new Date(
                parseInt(currentMonth.split(' ')[1], 10),
                getMonthIndex(currentMonth.split(' ')[0]),
                1
              )
            : new Date()
        }
        events={events}
        headerToolbar={{
          left: '',
          center: '',
          right: '',
        }}
        height="auto"
        firstDay={1}
        locales={[roLocale]}
        locale={language === 'ro' ? 'ro' : 'en'}
        eventClick={handleEventClick}
        eventContent={(eventInfo) => {
          const amount = eventInfo.event.extendedProps.total;
          const count = eventInfo.event.extendedProps.count as number;
          const partnerOnly = !!eventInfo.event.extendedProps.partnerOnly;
          const baseClasses =
            'px-3 py-2 rounded-lg flex flex-col items-center justify-center min-h-10 border-0 outline-none text-center font-semibold leading-tight shadow-[0_1px_3px_rgba(0,0,0,0.2)] box-border ';
          const colorClasses =
            variant === 'income'
              ? 'bg-green-500/90 text-white'
              : partnerOnly
                ? 'bg-[var(--color-app-accent)]/90 text-white'
                : getEventColorClasses(getExpenseTier(amount));
          const responsiveClasses =
            'max-[640px]:px-2.5 max-[640px]:py-1.5 max-[640px]:min-h-9 max-[640px]:rounded-md';

          return (
            <div
              className={`${baseClasses} ${colorClasses} ${responsiveClasses}`}
            >
              <div className="text-[0.95rem] font-bold mb-0.5 leading-tight tracking-wide max-[640px]:text-[0.8rem]">
                {eventInfo.event.title}
              </div>
              {!partnerOnly && (
                <div className="text-xs font-medium opacity-95">
                  {count} {t('ux.items')}
                </div>
              )}
            </div>
          );
        }}
        dayCellClassNames={(args) => {
          const classes = ['calendar-day-cell'];
          if (args.isToday) {
            classes.push('calendar-day-today');
          }
          return classes.join(' ');
        }}
        dayHeaderClassNames="calendar-day-header"
      />

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
                return new Date(selectedDate).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                });
              })()
            : ''
        }
        topContent={
          selectedDayTransactions.length > 0 ? (
            <>
              {t('common.total')}: <strong>{formatNumber(selectedDayTotal)}</strong>
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
