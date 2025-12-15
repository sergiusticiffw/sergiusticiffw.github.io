import { useEffect, useState, useMemo } from 'react';
import { useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import {
  deleteNode,
  formatNumber,
  extractMonthsFromRawData,
} from '@utils/utils';
import { getCategories, notificationType } from '@utils/constants';
import TransactionFilters from '@components/Home/TransactionFilters';
import TransactionList from '@components/TransactionList';
import CalendarView from '@components/CalendarView';
import Modal from '@components/Modal';
import TransactionForm from '@components/TransactionForm';
import {
  PageHeader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmModal,
  NoData,
} from '@components/Common';
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
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import './NewHome.scss';
import { fetchExpenses as fetchExpensesService } from '@api/expenses';
import { useApiClient } from '@hooks/useApiClient';

const NewHome = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');
  const [selectedMonth, setSelectedMonth] = useState(data.selectedMonth ?? '');
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionFormSubmitting, setTransactionFormSubmitting] =
    useState(false);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');

  const apiClient = useApiClient();

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [data, dataDispatch, noData, apiClient]);

  // Update filters in context
  useEffect(() => {
    dataDispatch({
      type: 'FILTER_DATA',
      category: selectedCategory,
      textFilter: searchText,
      selectedMonth: selectedMonth,
    });
  }, [searchText, selectedCategory, selectedMonth, dataDispatch]);

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
    if (searchText !== '' || selectedCategory !== '' || selectedMonth !== '') {
      setCurrentMonthIndex(0);
    }
  }, [searchText, selectedCategory, selectedMonth]);

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
  // Note: When category filter is applied, items.groupedData already contains only filtered transactions
  // So we only need to apply text search filter if it exists
  const filteredTransactions = useMemo(() => {
    const monthTransactions = items.groupedData?.[currentMonth] || [];

    // If category is filtered in context, items.groupedData already contains only that category
    // So we only need to filter by text search if it exists
    if (searchText !== '') {
      const searchLower = searchText.toLowerCase();
      return monthTransactions.filter(
        (transaction: TransactionOrIncomeItem) => {
          const descriptionMatch =
            transaction.dsc?.toLowerCase().includes(searchLower) || false;

          // Get category label and check if it matches
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

    return monthTransactions;
  }, [items.groupedData, currentMonth, searchText, localizedCategories]);

  // Check if any filters are active
  const hasFilters =
    searchText !== '' || selectedCategory !== '' || selectedMonth !== '';

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

  // Get income for current month (income is not filtered)
  const incomeTotals = items.incomeTotals;
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
    <div className="page-container newhome-page">
      {/* Delete Modal */}
      <DeleteConfirmModal
        show={!!showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
        onConfirm={() =>
          showDeleteModal && handleDelete(showDeleteModal, token)
        }
        title={t('transaction.deleteTransaction')}
        isSubmitting={isSubmitting}
      />

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
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
          onFormReady={(submitHandler, isSubmitting) => {
            setTransactionFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
          }}
        />
      </Modal>

      {/* Add Modal */}
      <Modal
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
      </Modal>

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
          <div className="newhome-search-wrapper">
            <TransactionFilters
              searchValue={searchText}
              categoryValue={selectedCategory}
              selectedMonth={selectedMonth}
              categories={localizedCategories}
              availableMonths={allMonths}
              onSearchChange={setSearchText}
              onCategoryChange={setSelectedCategory}
              onMonthChange={setSelectedMonth}
              onClearFilters={() => {
                setSearchText('');
                setSelectedCategory('');
                setSelectedMonth('');
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
          <div className="newhome-view-tabs">
            <button
              className={`tab-button ${activeView === 'list' ? 'active' : ''}`}
              onClick={() => setActiveView('list')}
            >
              <FiList />
              <span>List</span>
            </button>
            <button
              className={`tab-button ${activeView === 'calendar' ? 'active' : ''}`}
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
                        setCurrentMonthIndex(0); // Reset to current month
                      },
                    }
                  : undefined
              }
            />
          ) : activeView === 'list' ? (
            <div className="newhome-transaction-wrapper">
              <TransactionList
                transactions={filteredTransactions}
                categoryLabels={localizedCategories}
                onEdit={handleEdit}
                onDelete={(id) => setShowDeleteModal(id)}
              />
            </div>
          ) : (
            <div className="newhome-calendar-wrapper">
              <CalendarView
                transactions={filteredTransactions}
                currentMonth={currentMonth}
                categoryLabels={localizedCategories}
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
            <div className="newhome-month-navigation-sticky">
              <button
                className="nav-button-sticky"
                onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
                disabled={currentMonthIndex >= months.length - 1}
                aria-label="Previous month"
              >
                <FiChevronLeft />
              </button>

              <button
                className="nav-button-sticky"
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
            className="newhome-fab"
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
