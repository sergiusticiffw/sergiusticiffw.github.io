import { useEffect, useState, useMemo } from 'react';
import { useAuthState } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { useChartsThemeSync } from '@shared/context/highcharts';
import {
  deleteNode,
  formatNumber,
  extractMonthsFromRawData,
  hasTag,
} from '@shared/utils/utils';
import { getCategories, notificationType } from '@shared/utils/constants';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import TransactionFilters from '@features/expenses/components/Home/TransactionFilters';
import TransactionList from '@features/expenses/components/TransactionList';
import CalendarView from '@features/expenses/components/CalendarView';
import VaulDrawer from '@shared/components/VaulDrawer';
import TransactionForm from '@features/expenses/components/TransactionForm';
import {
  PageHeader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmDrawer,
  NoData,
} from '@shared/components/Common';
import {
  FiPlus,
  FiEdit2,
  FiDollarSign,
  FiBriefcase,
  FiChevronLeft,
  FiChevronRight,
  FiList,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
} from 'react-icons/fi';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';

const NewHome = () => {
  useChartsThemeSync();
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState();
  const { data, dataDispatch } = useExpenseData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');
  const [selectedMonth, setSelectedMonth] = useState(data.selectedMonth ?? '');
  const [selectedTag, setSelectedTag] = useState(data.selectedTag ?? '');
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionFormSubmitting, setTransactionFormSubmitting] =
    useState(false);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');

  const apiClient = useApiClient();

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
      selectedMonth: selectedMonth,
      selectedTag: selectedTag,
    });
  }, [searchText, selectedCategory, selectedMonth, selectedTag, dataDispatch]);

  const items = data.filtered || data;
  const localizedCategories = getCategories();

  // Get ALL available months from UNFILTERED raw data in YYYY-MM format (for month picker)
  const allMonths =
    data.raw && data.raw.length > 0 ? extractMonthsFromRawData(data.raw) : [];

  // Get months from current view (filtered or unfiltered)
  const months = items.groupedData ? Object.keys(items.groupedData) : [];
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

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

  // Reset to most recent month when filters are applied
  useEffect(() => {
    if (searchText !== '' || selectedCategory !== '' || selectedMonth !== '' || selectedTag !== '') {
      setCurrentMonthIndex(0);
    }
  }, [searchText, selectedCategory, selectedMonth, selectedTag]);

  // Navigate to selected month
  useEffect(() => {
    if (selectedMonth && months.length > 0) {
      const monthIndex = months.findIndex((month) => month === selectedMonth);
      if (monthIndex !== -1) {
        setCurrentMonthIndex(monthIndex);
      }
    }
  }, [selectedMonth, months]);

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
        const categoryMatch = categoryLabel
          .toLowerCase()
          .includes(searchLower);

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
  }, [items.groupedData, currentMonth, searchText, selectedTag, localizedCategories]);

  // Check if any filters are active
  const hasFilters =
    searchText !== '' || selectedCategory !== '' || selectedMonth !== '' || selectedTag !== '';

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

  // Get income for current month (income is not filtered; use full data, not filtered)
  const incomeTotals = data.incomeTotals;
  const monthIncome = incomeTotals ? incomeTotals[currentMonth] || 0 : 0;

  // Calculate profit based on filtered total
  const filteredProfit = parseFloat((monthIncome - filteredTotal).toFixed(2));

  // Decide which values to show - filtered or full month
  const displayTotal = hasFilters
    ? filteredTotal
    : items.totals?.[currentMonth] || 0;
  const displayIncome = monthIncome;
  const displayProfit = hasFilters
    ? filteredProfit
    : parseFloat(
        (monthIncome - (items.totals?.[currentMonth] || 0)).toFixed(2)
      );

  return (
    <div className="page-container">
      {/* Delete Drawer (Vaul) */}
      <DeleteConfirmDrawer
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => showDeleteModal && handleDelete(showDeleteModal, token)}
        title={t('transaction.deleteTransaction')}
        message={t('modal.deleteTransaction')}
        isSubmitting={isSubmitting}
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
          <button
            type="submit"
            form="transaction-form-edit"
            disabled={transactionFormSubmitting}
            className="btn-submit"
          >
            {transactionFormSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <>
                <FiEdit2 />
                <span>{t('transactionForm.editTitle')}</span>
              </>
            )}
          </button>
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
        }}
        title={t('transactionForm.addTransaction')}
        footer={
          <button
            type="submit"
            form="transaction-form-add"
            disabled={transactionFormSubmitting}
            className="btn-submit"
          >
            {transactionFormSubmitting ? (
              <div className="loader">
                <span></span>
                <span></span>
                <span></span>
              </div>
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
          formType="add"
          values={{}}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setTransactionFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowAddModal(false);
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
          {/* Header */}
          <PageHeader
            title={currentMonth || t('home.title')}
            subtitle={`${filteredTransactions.length} ${filteredTransactions.length === 1 ? t('common.transaction') : t('common.transactions')}`}
          />

          {/* Filters - For Both Views */}
          <div className="mb-6">
            <TransactionFilters
              searchValue={searchText}
              categoryValue={selectedCategory}
              selectedMonth={selectedMonth}
              selectedTag={selectedTag}
              categories={localizedCategories}
              availableMonths={allMonths}
              onSearchChange={setSearchText}
              onCategoryChange={setSelectedCategory}
              onMonthChange={setSelectedMonth}
              onTagChange={setSelectedTag}
              onClearFilters={() => {
                setSearchText('');
                setSelectedCategory('');
                setSelectedMonth('');
                setSelectedTag('');
                setCurrentMonthIndex(0);
              }}
            />
          </div>

          {/* Stats Cards - Show all 3 when no filters, only Total when filtered */}
          <StatsGrid columns={3} filtered={hasFilters}>
            <StatCard
              icon={<FiDollarSign />}
              value={formatNumber(displayTotal)}
              label={t('common.total')}
            />

            {!hasFilters && (
              <>
                <StatCard
                  icon={<FiBriefcase />}
                  value={formatNumber(displayIncome)}
                  label={t('common.income')}
                />

                <StatCard
                  icon={
                    displayProfit >= 0 ? <FiTrendingUp /> : <FiTrendingDown />
                  }
                  value={formatNumber(displayProfit)}
                  label={t('common.profit')}
                />
              </>
            )}
          </StatsGrid>

          {/* View Tabs - Below Search */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              className={`flex-1 rounded-xl py-3.5 px-4 text-[0.95rem] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 border-none ${
                activeView === 'list'
                  ? 'bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] text-white font-medium shadow-[0_2px_8px_rgba(91,141,239,0.3)]'
                  : 'bg-white/[0.05] text-white/60 hover:bg-white/10 hover:text-white/80'
              } [&_svg]:text-lg`}
              onClick={() => setActiveView('list')}
            >
              <FiList />
              <span>List</span>
            </button>
            <button
              className={`flex-1 rounded-xl py-3.5 px-4 text-[0.95rem] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 border-none ${
                activeView === 'calendar'
                  ? 'bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] text-white font-medium shadow-[0_2px_8px_rgba(91,141,239,0.3)]'
                  : 'bg-white/[0.05] text-white/60 hover:bg-white/10 hover:text-white/80'
              } [&_svg]:text-lg`}
              onClick={() => setActiveView('calendar')}
            >
              <FiCalendar />
              <span>Calendar</span>
            </button>
          </div>

          {/* Content - List or Calendar */}
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
                        setSelectedMonth('');
                        setSelectedTag('');
                        setCurrentMonthIndex(0); // Reset to current month
                      },
                    }
                  : undefined
              }
            />
          ) : activeView === 'list' ? (
            <div>
              <TransactionList
                transactions={filteredTransactions.map((t) => ({
                  ...t,
                  dsc: t.dsc ?? '',
                }))}
                categoryLabels={localizedCategories}
                pendingSyncIds={pendingSyncIds}
                onEdit={handleEdit}
                onDelete={(id) => setShowDeleteModal(id)}
              />
            </div>
          ) : (
            <div className="mb-8">
              <CalendarView
                transactions={filteredTransactions}
                currentMonth={currentMonth}
                categoryLabels={localizedCategories}
                pendingSyncIds={pendingSyncIds}
                onMonthChange={(direction) => {
                  if (
                    direction === 'prev' &&
                    currentMonthIndex < months.length - 1
                  ) {
                    setCurrentMonthIndex(currentMonthIndex + 1);
                  } else if (direction === 'next' && currentMonthIndex > 0) {
                    setCurrentMonthIndex(currentMonthIndex - 1);
                  }
                }}
                onEdit={handleEdit}
                onDelete={(id) => setShowDeleteModal(id)}
              />
            </div>
          )}

          {/* Month Navigation - Sticky at Bottom (Only for List View) */}
          {activeView === 'list' && (
            <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 flex justify-center gap-4 z-[100] bg-[rgba(26,26,26,0.9)] backdrop-blur-md py-3 px-5 rounded-[20px] shadow-lg max-[360px]:bottom-[60px] max-[360px]:py-2.5">
              <button
                type="button"
                className="w-[50px] h-[50px] flex items-center justify-center rounded-xl border border-white/15 bg-white/10 cursor-pointer transition-all duration-200 shadow-md [&_svg]:text-white/90 [&_svg]:text-[1.3rem] hover:not(:disabled):bg-white/[0.18] hover:not(:disabled):border-[#5b8def]/40 hover:not(:disabled):scale-105 disabled:opacity-30 disabled:cursor-not-allowed max-[360px]:w-[46px] max-[360px]:h-[46px]"
                onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
                disabled={currentMonthIndex >= months.length - 1}
                aria-label="Previous month"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                className="w-[50px] h-[50px] flex items-center justify-center rounded-xl border border-white/15 bg-white/10 cursor-pointer transition-all duration-200 shadow-md [&_svg]:text-white/90 [&_svg]:text-[1.3rem] hover:not(:disabled):bg-white/[0.18] hover:not(:disabled):border-[#5b8def]/40 hover:not(:disabled):scale-105 disabled:opacity-30 disabled:cursor-not-allowed max-[360px]:w-[46px] max-[360px]:h-[46px]"
                onClick={() => setCurrentMonthIndex(currentMonthIndex - 1)}
                disabled={currentMonthIndex <= 0}
                aria-label="Next month"
              >
                <FiChevronRight />
              </button>
            </div>
          )}

          {/* FAB */}
          <button
            className="fab"
            onClick={() => setShowAddModal(true)}
            title="Add Transaction"
          >
            <FiPlus />
          </button>
        </>
      )}
    </div>
  );
};

export default NewHome;
