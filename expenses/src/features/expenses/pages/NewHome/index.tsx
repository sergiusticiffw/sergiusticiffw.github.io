import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useAuthState } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { useChartsThemeSync } from '@shared/context/highcharts';
import {
  deleteNode,
  formatNumber,
  hasTag,
  parseMonthString,
} from '@shared/utils/utils';
import { getCategories, notificationType } from '@shared/utils/constants';
import { localizeMonthKey } from '@shared/utils/monthLabel';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import { useHorizontalMonthSwipe } from '@shared/hooks/useHorizontalMonthSwipe';
import TransactionFilters, { DateRangeValue } from '@features/expenses/components/Home/TransactionFilters';
import VoiceEntryButton from '@features/expenses/components/Home/VoiceEntryButton';
import { TransactionsList } from '@shared/components/TransactionsList';
import { HeroSpendCard } from '@shared/components/HeroSpendCard';
import MonthNavBar from '@shared/components/MonthNavBar';
import BudgetRings from '@features/expenses/components/budgets/BudgetRings';
import CalendarView from '@features/expenses/components/CalendarView';
import FamilySharedSpend from '@features/expenses/components/Charts/FamilySharedSpend';
import FamilyIncomeShare from '@features/expenses/components/Charts/FamilyIncomeShare';
import FamilyGoalsProgress from '@features/expenses/components/Charts/FamilyGoalsProgress';
import VaulDrawer from '@shared/components/VaulDrawer';
import TransactionForm from '@features/expenses/components/TransactionForm';
import {
  Loader,
  LoadingSpinner,
  DeleteConfirmDrawer,
  NoData,
  StatCard,
  StatsGrid,
} from '@shared/components/Common';
import { PAGE_CONTAINER_CLASS, BTN_SUBMIT_CLASS, FAB_CLASS } from '@shared/utils/layoutClasses';
import { IconButton, cn } from '@shared/ui';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiDollarSign,
  FiList,
  FiCalendar,
} from 'react-icons/fi';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';

/**
 * Month to open on. `months` is newest first, so future-dated records sit at
 * the front; pick the current calendar month, or the closest month before it.
 */
const defaultMonthIndex = (months: string[]): number => {
  if (months.length === 0) return 0;
  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const index = months.findIndex((label) => {
    const date = parseMonthString(label);
    return !!date && date.getFullYear() * 12 + date.getMonth() <= current;
  });
  // Only future months exist: the last one is the closest to today.
  return index === -1 ? months.length - 1 : index;
};

const NewHome = () => {
  useChartsThemeSync();
  const showNotification = useNotification();
  const { t, language } = useLocalization();
  const { token } = useAuthState();
  const { data, dataDispatch } = useExpenseData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');
  const [selectedTag, setSelectedTag] = useState(data.selectedTag ?? '');
  const [dateRange, setDateRange] = useState<DateRangeValue>(data.dateRange ?? null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormValues, setAddFormValues] = useState<Record<string, string>>(
    {}
  );
  const [focusedItem, setFocusedItem] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionFormSubmitting, setTransactionFormSubmitting] =
    useState(false);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const apiClient = useApiClient();
  const location = useLocation();
  const navigate = useNavigate();
  const routePrefill = (
    location.state as
      | {
          prefill?: {
            field_category?: string;
            field_description?: string;
            field_amount?: string;
            field_date?: string;
          };
        }
      | undefined
  )?.prefill;

  useEffect(() => {
    if (!routePrefill) return;
    setAddFormValues({
      ...(routePrefill.field_category
        ? { field_category: routePrefill.field_category }
        : {}),
      ...(routePrefill.field_description
        ? { field_description: routePrefill.field_description }
        : {}),
      ...(routePrefill.field_amount
        ? { field_amount: routePrefill.field_amount }
        : {}),
      ...(routePrefill.field_date
        ? { field_date: routePrefill.field_date }
        : {}),
    });
    setShowAddModal(true);
    navigate({ to: location.pathname, replace: true, state: {} });
  }, [routePrefill, navigate, location.pathname]);

  // Event-driven pending sync tracking (no polling) - for expenses
  const pendingSyncIds = usePendingSyncIds(['expense']);

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [noData, apiClient, dataDispatch]);

  // Update filters in context
  useEffect(() => {
    dataDispatch({
      type: 'FILTER_DATA',
      category: selectedCategory,
      textFilter: searchText,
      selectedTag: selectedTag,
      dateRange: dateRange ?? null,
    });
  }, [searchText, selectedCategory, selectedTag, dateRange, dataDispatch]);

  const items = data.filtered || data;
  const localizedCategories = getCategories();

  // Get months from current view (filtered or unfiltered) for list navigation
  const months = items.groupedData ? Object.keys(items.groupedData) : [];
  const [currentMonthIndex, setCurrentMonthIndex] = useState(() =>
    defaultMonthIndex(months)
  );
  // True until the month list has loaded (or after a filter change), so the
  // first non-empty list opens on the current month, not the newest record.
  const pendingMonthReset = useRef(months.length === 0);

  // Ensure currentMonthIndex is valid when months array changes
  useEffect(() => {
    if (months.length > 0) {
      // If current index is out of bounds, reset to 0
      if (currentMonthIndex >= months.length) {
        setCurrentMonthIndex(0);
      }
    } else {
      setCurrentMonthIndex(0);
    }
  }, [months, currentMonthIndex]);

  const currentMonth = months[currentMonthIndex] || months[0] || '';

  // Go back to the current month when filters change. The filtered month list
  // arrives on the next render, so the reset is also applied once it changes.
  const hasDateRangeFilter = !!(dateRange?.start && dateRange?.end);
  useEffect(() => {
    pendingMonthReset.current = true;
    setCurrentMonthIndex(defaultMonthIndex(months));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on filter change
  }, [searchText, selectedCategory, selectedTag, hasDateRangeFilter]);

  const monthsSignature = months.join('|');
  useEffect(() => {
    if (!pendingMonthReset.current || months.length === 0) return;
    pendingMonthReset.current = false;
    setCurrentMonthIndex(defaultMonthIndex(months));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the month list
  }, [monthsSignature]);

  const handleEdit = (id: string) => {
    const item = items.groupedData[currentMonth].find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_category: item.cat,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (id: string, token: string) => {
    setIsSubmitting(true);
    deleteNode(
      id,
      token,
      (response: Response) => {
        if (response.ok) {
          showNotification(
            t('notification.transactionDeleted'),
            notificationType.SUCCESS
          );
          setIsSubmitting(false);
        } else {
          showNotification(t('error.unknown'), notificationType.ERROR);
          setIsSubmitting(false);
        }
        setShowDeleteModal(false);
        // Don't fetch - UI already updated by deleteNode
      },
      dataDispatch
    );
  };

  // Get transactions for current month
  // Note: When category/tag filter is applied, items.groupedData already contains only filtered transactions
  // So we only need to apply text search filter if it exists
  const filteredTransactions = useMemo(() => {
    const monthTransactions = items.groupedData?.[currentMonth] || [];

    return monthTransactions.filter((transaction: TransactionOrIncomeItem) => {
      // Text filter
      if (searchText !== '') {
        const searchLower = searchText.toLowerCase();
        const descriptionMatch =
          transaction.dsc?.toLowerCase().includes(searchLower) || false;

        // Get category label and check if it matches
        const categoryLabel =
          localizedCategories.find((cat) => cat.value === transaction.cat)
            ?.label || '';
        const categoryMatch = categoryLabel.toLowerCase().includes(searchLower);

        if (!descriptionMatch && !categoryMatch) {
          return false;
        }
      }

      // Tag filter (applied locally since reducer handles category/text/month)
      if (selectedTag) {
        if (!hasTag(transaction, selectedTag)) {
          return false;
        }
      }

      return true;
    });
  }, [
    items.groupedData,
    currentMonth,
    searchText,
    selectedTag,
    localizedCategories,
  ]);

  // Check if any filters are active
  const hasFilters =
    searchText !== '' ||
    selectedCategory !== '' ||
    selectedTag !== '' ||
    hasDateRangeFilter;

  // Auto-navigate to first month with filtered data
  useEffect(() => {
    if (
      hasFilters &&
      filteredTransactions.length === 0 &&
      months.length > 0 &&
      items.groupedData
    ) {
      // Search for first month with matching transactions
      for (let i = 0; i < months.length; i++) {
        const monthTransactions = items.groupedData[months[i]] || [];

        // If category is filtered, items.groupedData already contains only that category
        // So we only need to filter by text search if it exists
        let matchingTransactions = monthTransactions;
        if (searchText !== '') {
          const searchLower = searchText.toLowerCase();
          matchingTransactions = monthTransactions.filter(
            (transaction: TransactionOrIncomeItem) => {
              const descriptionMatch =
                transaction.dsc?.toLowerCase().includes(searchLower) || false;

              const categoryLabel =
                localizedCategories.find((cat) => cat.value === transaction.cat)
                  ?.label || '';
              const categoryMatch = categoryLabel
                .toLowerCase()
                .includes(searchLower);

              return descriptionMatch || categoryMatch;
            }
          );
        }

        if (matchingTransactions.length > 0) {
          setCurrentMonthIndex(i);
          break;
        }
      }
    }
  }, [
    searchText,
    selectedCategory,
    hasFilters,
    filteredTransactions.length,
    months,
    items.groupedData,
    localizedCategories,
  ]);

  // Calculate stats based on filtered transactions
  const filteredTotal = filteredTransactions.reduce(
    (sum, transaction) =>
      sum +
      (typeof transaction.sum === 'string'
        ? parseFloat(transaction.sum)
        : transaction.sum),
    0
  );

  // Get income for current month (only shown when no filters are active)
  const incomeTotals = data.incomeTotals;
  const monthIncome = incomeTotals ? incomeTotals[currentMonth] || 0 : 0;

  const displayTotal = hasFilters
    ? filteredTotal
    : items.totals?.[currentMonth] || 0;
  const displayIncome = monthIncome;
  const displayProfit = parseFloat(
    (monthIncome - (items.totals?.[currentMonth] || 0)).toFixed(2)
  );

  const prevMonthKey =
    currentMonthIndex < months.length - 1 ? months[currentMonthIndex + 1] : null;
  const prevMonthTotal = prevMonthKey
    ? items.totals?.[prevMonthKey] || 0
    : 0;

  const monthDate = currentMonth ? new Date(`${currentMonth} 1`) : new Date();
  const now = new Date();
  const isCurrentMonth =
    monthDate.getFullYear() === now.getFullYear() &&
    monthDate.getMonth() === now.getMonth();
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate();
  const today = now.getDate();
  const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - today) : null;

  // Month-over-month change. While the month is still running, compare against
  // the previous month up to the same day, otherwise a partial month is always
  // compared with a full one and looks like a big saving.
  const sumUpToDay = (txs: TransactionOrIncomeItem[], maxDay: number) =>
    txs.reduce((sum, tx) => {
      const day = parseInt(String(tx.dt || '').slice(8, 10), 10);
      if (!day || day > maxDay) return sum;
      return sum + (parseFloat(String(tx.sum)) || 0);
    }, 0);
  const paceAdjusted = isCurrentMonth && !hasFilters;
  const deltaCurrent = paceAdjusted
    ? sumUpToDay(items.groupedData?.[currentMonth] || [], today)
    : displayTotal;
  const deltaPrevious =
    paceAdjusted && prevMonthKey
      ? sumUpToDay(items.groupedData?.[prevMonthKey] || [], today)
      : prevMonthTotal;
  const deltaPct =
    deltaPrevious > 0 && !hasFilters
      ? (((deltaCurrent - deltaPrevious) / deltaPrevious) * 100).toFixed(1)
      : null;
  const deltaSuffix = paceAdjusted
    ? t('ux.vsLastMonthSoFar')
    : t('ux.vsLastMonth');

  const deleteItem = useMemo(() => {
    if (!showDeleteModal) return null;
    const tx = filteredTransactions.find(
      (item: TransactionOrIncomeItem) => item.id === showDeleteModal
    );
    return tx
      ? { variant: 'expense' as const, dt: tx.dt, dsc: tx.dsc, sum: tx.sum, cat: tx.cat }
      : null;
  }, [showDeleteModal, filteredTransactions]);

  const handleMonthSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev' && currentMonthIndex < months.length - 1) {
        setCurrentMonthIndex(currentMonthIndex + 1);
      } else if (direction === 'next' && currentMonthIndex > 0) {
        setCurrentMonthIndex(currentMonthIndex - 1);
      }
    },
    [currentMonthIndex, months.length]
  );

  const monthSwipeHandlers = useHorizontalMonthSwipe(
    handleMonthSwipe,
    activeView === 'calendar' && !filterPanelOpen && !showAddModal && !showEditModal && !showDeleteModal
  );

  const viewToggle = (
    <>
      <IconButton
        size="sm"
        aria-label={t('ux.listView')}
        aria-pressed={activeView === 'list'}
        className={cn(
          activeView === 'list' &&
            'bg-[var(--color-app-accent)] text-[var(--color-btn-on-accent)] hover:bg-[var(--color-app-accent-hover)] hover:text-[var(--color-btn-on-accent)]'
        )}
        onClick={() => setActiveView('list')}
      >
        <FiList />
      </IconButton>
      <IconButton
        size="sm"
        aria-label={t('ux.calendarView')}
        aria-pressed={activeView === 'calendar'}
        className={cn(
          activeView === 'calendar' &&
            'bg-[var(--color-app-accent)] text-[var(--color-btn-on-accent)] hover:bg-[var(--color-app-accent-hover)] hover:text-[var(--color-btn-on-accent)]'
        )}
        onClick={() => setActiveView('calendar')}
      >
        <FiCalendar />
      </IconButton>
    </>
  );

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {/* Delete Drawer (Vaul) */}
      <DeleteConfirmDrawer
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() =>
          showDeleteModal && handleDelete(showDeleteModal, token)
        }
        title={t('transaction.deleteTransaction')}
        message={t('modal.deleteTransaction')}
        isSubmitting={isSubmitting}
        item={deleteItem}
      />

      {/* Edit Transaction Drawer */}
      <VaulDrawer
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
          setFocusedItem({});
        }}
        title={t('transactionForm.editTransaction')}
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              form="transaction-form-edit"
              disabled={transactionFormSubmitting}
              className={BTN_SUBMIT_CLASS}
            >
              {transactionFormSubmitting ? (
                <Loader variant="on-button" />
              ) : (
                <>
                  <FiEdit2 />
                  <span>{t('transactionForm.editTitle')}</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <TransactionForm
          formType="edit"
          values={focusedItem}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, submitting) => {
            setTransactionFormSubmitting(submitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setFocusedItem({});
          }}
        />
      </VaulDrawer>

      {/* Add Drawer */}
      <VaulDrawer
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
          setAddFormValues({});
        }}
        title={t('transactionForm.addTransaction')}
        footer={
          <button
            type="submit"
            form="transaction-form-add"
            disabled={transactionFormSubmitting}
            className={BTN_SUBMIT_CLASS}
          >
            {transactionFormSubmitting ? (
              <Loader variant="on-button" />
            ) : (
              <>
                <FiPlus />
                <span>{t('transactionForm.title')}</span>
              </>
            )}
          </button>
        }
      >
        <TransactionForm
          key={`add-${addFormValues.field_category || ''}-${addFormValues.field_description || ''}`}
          formType="add"
          values={addFormValues}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
            setTransactionFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setAddFormValues({});
          }}
        />
      </VaulDrawer>

      {loading ? (
        <LoadingSpinner />
      ) : noData ? (
        <NoData
          icon={<FiDollarSign />}
          title={t('home.noData')}
          description={t('home.noDataDesc')}
        />
      ) : (
        <>
          <div {...monthSwipeHandlers}>
            <div className="pt-6">
              <HeroSpendCard
                title={
                  currentMonth
                    ? localizeMonthKey(currentMonth, language)
                    : t('home.title')
                }
                meta={`${filteredTransactions.length} ${filteredTransactions.length === 1 ? t('common.transaction') : t('common.transactions')}`}
                label={
                  isCurrentMonth ? t('home.spentThisMonth') : t('ux.spent')
                }
                amount={formatNumber(displayTotal)}
                deltaLabel={
                  deltaPct != null
                    ? `${Number(deltaPct) >= 0 ? '+' : ''}${deltaPct}% ${deltaSuffix}`
                    : undefined
                }
                deltaPositive={
                  deltaPct != null ? Number(deltaPct) <= 0 : undefined
                }
                footer={
                  !hasFilters && isCurrentMonth && daysLeft != null
                    ? `${daysLeft} ${t('home.daysLeft')}`
                    : undefined
                }
              />
            </div>

            <StatsGrid
              columns={2}
              filtered={false}
              className={cn(
                'gap-2 mb-4 sm:gap-2',
                hasFilters && 'opacity-60'
              )}
            >
              <StatCard
                value={formatNumber(displayIncome)}
                label={t('common.income')}
              />
              <StatCard
                value={`${displayProfit > 0 ? '+' : ''}${formatNumber(displayProfit)}`}
                label={t('ux.net')}
                labelHidden
                tone={displayProfit < 0 ? 'negative' : undefined}
                hint={
                  displayIncome > 0
                    ? `${t('ux.savingsRate')} ${Math.round((displayProfit / displayIncome) * 100)}%`
                    : undefined
                }
              />
            </StatsGrid>

            <BudgetRings monthLabel={currentMonth} visible={!hasFilters} />

            {/* Search / filters — before view tabs */}
            <div className="mb-6">
              <TransactionFilters
                searchValue={searchText}
                categoryValue={selectedCategory}
                selectedTag={selectedTag}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                categories={localizedCategories}
                onSearchChange={setSearchText}
                onCategoryChange={setSelectedCategory}
                onTagChange={setSelectedTag}
                onClearFilters={() => {
                  setSearchText('');
                  setSelectedCategory('');
                  setSelectedTag('');
                  setDateRange(null);
                  setCurrentMonthIndex(0);
                }}
                onFilterPanelOpenChange={setFilterPanelOpen}
              />
            </div>

            {/* Content - List or Calendar */}
            {activeView === 'list' ? (
              filteredTransactions.length === 0 ? (
                <NoData
                  icon={<FiDollarSign />}
                  title={t('home.noTransactionsFound')}
                  description={
                    hasFilters
                      ? t('home.tryDifferentFilters')
                      : t('home.noDataDesc')
                  }
                  action={
                    hasFilters
                      ? {
                          label: t('common.clearFilters'),
                          onClick: () => {
                            setSearchText('');
                            setSelectedCategory('');
                            setSelectedTag('');
                            setDateRange(null);
                            setCurrentMonthIndex(0);
                          },
                        }
                      : undefined
                  }
                />
              ) : (
                <div>
                  <TransactionsList
                    transactions={filteredTransactions.map((tx) => ({
                      ...tx,
                      dsc: tx.dsc ?? '',
                    }))}
                    pendingSyncIds={pendingSyncIds}
                    onEdit={handleEdit}
                    onDelete={(id) => setShowDeleteModal(id)}
                    groupByDay
                    toolbarEnd={viewToggle}
                  />
                </div>
              )
            ) : (
              <div className="mb-8">
                <div className="flex items-center justify-end gap-1 mb-2">
                  {viewToggle}
                </div>
                {filteredTransactions.length === 0 ? (
                  <NoData
                    icon={<FiDollarSign />}
                    title={t('home.noTransactionsFound')}
                    description={
                      hasFilters
                        ? t('home.tryDifferentFilters')
                        : t('home.noDataDesc')
                    }
                    action={
                      hasFilters
                        ? {
                            label: t('common.clearFilters'),
                            onClick: () => {
                              setSearchText('');
                              setSelectedCategory('');
                              setSelectedTag('');
                              setDateRange(null);
                              setCurrentMonthIndex(0);
                            },
                          }
                        : undefined
                    }
                  />
                ) : (
                  <CalendarView
                    transactions={filteredTransactions}
                    currentMonth={currentMonth}
                    pendingSyncIds={pendingSyncIds}
                    onMonthChange={handleMonthSwipe}
                    onEdit={handleEdit}
                    onDelete={(id) => setShowDeleteModal(id)}
                    categoryFilter={selectedCategory}
                    dateRange={dateRange}
                    hidePartnerSpend={searchText !== '' || selectedTag !== ''}
                  />
                )}
                <div className="mt-8 flex flex-col gap-8">
                  <FamilySharedSpend
                    monthLabel={currentMonth}
                    monthNavigation={false}
                  />
                  <FamilyGoalsProgress monthLabel={currentMonth} />
                  <FamilyIncomeShare monthLabel={currentMonth} />
                </div>
              </div>
            )}
          </div>

          {/* Month nav: always on list; on calendar only md+ (mobile uses swipe). Hidden when filter panel open */}
          {!filterPanelOpen &&
            (activeView === 'list' || activeView === 'calendar') && (
            <MonthNavBar
              className={activeView === 'calendar' ? 'hidden md:flex' : 'flex'}
              onPrevious={() => setCurrentMonthIndex(currentMonthIndex + 1)}
              onNext={() => setCurrentMonthIndex(currentMonthIndex - 1)}
              previousDisabled={currentMonthIndex >= months.length - 1}
              nextDisabled={currentMonthIndex <= 0}
            />
          )}

          {/* FAB - hidden when filter panel is open to avoid overlap */}
          {!filterPanelOpen && (
            <button
              className={FAB_CLASS}
              onClick={() => {
                setAddFormValues({});
                setShowAddModal(true);
              }}
              title={t('transactionForm.addTransaction')}
              aria-label={t('transactionForm.addTransaction')}
            >
              <FiPlus />
            </button>
          )}
        </>
      )}

      {!loading && !filterPanelOpen && (
        <VoiceEntryButton stacked={!noData} kind="expense" />
      )}
    </div>
  );
};

export default NewHome;
