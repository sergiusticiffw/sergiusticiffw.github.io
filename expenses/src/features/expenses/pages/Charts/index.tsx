import { useEffect, useState } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { availableCharts } from '@shared/utils/constants';
import { getCategories } from '@shared/utils/constants';
import TransactionFilters, { DateRangeValue } from '@features/expenses/components/Home/TransactionFilters';
import { extractMonthsFromRawData } from '@shared/utils/utils';
import VaulDrawer from '@shared/components/VaulDrawer';
import TransactionForm from '@features/expenses/components/TransactionForm';
import LoadingSpinner from '@shared/components/Common/LoadingSpinner';
import NoData from '@shared/components/Common/NoData';
import { FiPlus, FiBarChart2 } from 'react-icons/fi';
import MonthlySavingsTrend from '@features/expenses/components/Charts/MonthlySavingsTrend';
import MonthlyTotals from '@features/expenses/components/Charts/MonthlyTotals';
import SavingsHistory from '@features/expenses/components/Charts/SavingsHistory';
import YearAverageTrend from '@features/expenses/components/Charts/YearAverageTrend';
import MonthlyComparisonTrend from '@features/expenses/components/Charts/MonthlyComparisonTrend';
import AllTimeSpendings from '@features/expenses/components/Home/AllTimeSpendings';
import MonthlyAverage from '@features/expenses/components/Home/MonthlyAverage';
import MonthlyAverageTrend from '@features/expenses/components/Charts/MonthlyAverageTrend';
import DailyAverage from '@features/expenses/components/DailyAverage/DailyAverage';
import DailyAverageTrend from '@features/expenses/components/Charts/DailyAverageTrend';
import LastTwoMonthsAverage from '@features/expenses/components/Home/LastTwoMonthsAverage';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';
import { PAGE_CONTAINER_CLASS } from '@shared/utils/layoutClasses';

const componentMap = {
  MonthlyTotals,
  YearAverageTrend,
  MonthlyComparisonTrend,
  AllTimeSpendings,
  MonthlyAverage,
  MonthlySavingsTrend,
  MonthlyAverageTrend,
  DailyAverage,
  DailyAverageTrend,
  LastTwoMonthsAverage,
  SavingsHistory,
};

const Charts = () => {
  const { data, dataDispatch } = useExpenseData();
  const { t } = useLocalization();
  const noData = data.groupedData === null;
  const noEntries = Object.keys(data.raw || {}).length === 0;
  const loading = data.loading;

  const [visibleCharts, setVisibleCharts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionFormSubmitting, setTransactionFormSubmitting] =
    useState(false);
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');
  const [selectedTag, setSelectedTag] = useState(data.selectedTag ?? '');
  const [dateRange, setDateRange] = useState<DateRangeValue>(data.dateRange ?? null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const categoryLabels = getCategories();

  const apiClient = useApiClient();

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [data, dataDispatch, noData, apiClient]);

  // Load visible charts from localStorage
  useEffect(() => {
    const storedCharts =
      JSON.parse(localStorage.getItem('visibleCharts') || '[]') ||
      availableCharts;
    setVisibleCharts(storedCharts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update filters in context
  useEffect(() => {
    if (!loading && !noData) {
      dataDispatch({
        type: 'FILTER_DATA',
        category: selectedCategory,
        textFilter: searchText,
        selectedMonth: '',
        selectedTag: selectedTag,
        dateRange: dateRange ?? null,
      });
    }
  }, [
    searchText,
    selectedCategory,
    selectedTag,
    dateRange,
    loading,
    noData,
    dataDispatch,
  ]);

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {/* Header */}
      <div className="text-center mb-6 pt-6">
        <h1 className="text-2xl font-bold m-0 text-white md:text-2xl max-sm:text-xl">
          {t('charts.title')}
        </h1>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <TransactionFilters
          searchValue={searchText}
          categoryValue={selectedCategory}
          selectedMonth=""
          selectedTag={selectedTag}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          categories={categoryLabels}
          availableMonths={[]}
          onSearchChange={setSearchText}
          onCategoryChange={setSelectedCategory}
          onMonthChange={() => {}}
          onTagChange={setSelectedTag}
          onClearFilters={() => {
            setSearchText('');
            setSelectedCategory('');
            setSelectedTag('');
            setDateRange(null);
          }}
          showMonthFilter={false}
          onFilterPanelOpenChange={setFilterPanelOpen}
        />
      </div>

      {/* Loading State */}
      {loading && <LoadingSpinner />}

      {/* No Data State */}
      {!loading && noEntries && (
        <NoData
          icon={<FiBarChart2 />}
          title={t('common.noData')}
          description={t('common.noTransactions')}
          action={{
            label: t('transactionForm.addTransaction'),
            onClick: () => setShowAddModal(true),
          }}
        />
      )}

      {/* Charts Content */}
      {!loading && !noEntries && data.groupedData && (
        <div className="flex flex-col gap-8">
          {visibleCharts.map((chartKey) => {
            const ChartComponent = componentMap[chartKey];
            return ChartComponent ? (
              <div
                key={chartKey}
                className="p-0 border-none bg-transparent [&>div]:bg-transparent [&>div]:border-none [&>div]:p-0 [&>div]:m-0 [&_.spending-summary-container]:border-none [&_.most-expensive-table-container]:border-none [&_.year-income-average-trend-container]:border-none [&_.daily-average]:border-none [&_.heading]:block [&_.heading]:text-xl [&_.heading]:font-semibold [&_.heading]:text-white [&_.heading]:my-4 [&_.heading]:mb-4 [&_.heading]:pb-2 [&_.heading]:border-b-2 [&_.heading]:border-white/20 [&_.heading]:tracking-wide [&_.heading]:text-center [&_.highcharts-container]:border-none max-sm:[&_.heading]:text-lg max-sm:[&_.heading]:my-3 max-sm:[&_.heading]:mb-3 max-sm:[&_.heading]:pb-1.5"
              >
                <ChartComponent />
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Add Transaction Drawer */}
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
          onFormReady={(_submitHandler, isSubmitting) => {
            setTransactionFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            dataDispatch({
              type: 'FILTER_DATA',
              category: selectedCategory,
              textFilter: searchText,
              selectedTag: selectedTag,
            });
          }}
        />
      </VaulDrawer>

      {/* FAB - hidden when filter panel is open to avoid overlap */}
      {!filterPanelOpen && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fab"
          title={t('transactionForm.addTransaction')}
        >
          <FiPlus />
        </button>
      )}
    </div>
  );
};

export default Charts;
