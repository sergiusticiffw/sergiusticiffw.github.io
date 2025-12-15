import { useEffect, useState } from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { availableCharts } from '@utils/constants';
import { getCategories } from '@utils/constants';
import SearchBar from '@components/SearchBar/SearchBar';
import Modal from '@components/Modal';
import TransactionForm from '@components/TransactionForm';
import LoadingSpinner from '@components/Common/LoadingSpinner';
import NoData from '@components/Common/NoData';
import { FiPlus, FiBarChart2 } from 'react-icons/fi';
import MonthlySavingsTrend from '@components/Charts/MonthlySavingsTrend';
import MonthlyTotals from '@components/Charts/MonthlyTotals';
import SavingsHistory from '@components/Charts/SavingsHistory';
import YearAverageTrend from '@components/Charts/YearAverageTrend';
import MonthlyComparisonTrend from '@components/Charts/MonthlyComparisonTrend';
import AllTimeSpendings from '@components/Home/AllTimeSpendings';
import MonthlyAverage from '@components/Home/MonthlyAverage';
import MonthlyAverageTrend from '@components/Charts/MonthlyAverageTrend';
import DailyAverage from '@components/DailyAverage/DailyAverage';
import DailyAverageTrend from '@components/Charts/DailyAverageTrend';
import LastTwoMonthsAverage from '@components/Home/LastTwoMonthsAverage';
import { fetchExpenses as fetchExpensesService } from '@api/expenses';
import { useApiClient } from '@hooks/useApiClient';
import './Charts.scss';

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
  const { data, dataDispatch } = useData();
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
      });
    }
  }, [searchText, selectedCategory, loading, noData, dataDispatch]);

  return (
    <div className="charts-page-wrapper">
      {/* Header */}
      <div className="charts-header">
        <h1>{t('charts.title')}</h1>
      </div>

      {/* Search Bar */}
      <div className="charts-search-wrapper">
        <SearchBar
          searchValue={searchText}
          categoryValue={selectedCategory}
          categories={categoryLabels}
          onSearchChange={setSearchText}
          onCategoryChange={setSelectedCategory}
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
        <div className="charts-content">
          {visibleCharts.map((chartKey) => {
            const ChartComponent = componentMap[chartKey];
            return ChartComponent ? (
              <div key={chartKey} className="charts-section">
                <ChartComponent />
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Add Transaction Modal */}
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
            dataDispatch({
              type: 'FILTER_DATA',
              category: selectedCategory,
              textFilter: searchText,
            });
          }}
        />
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        title={t('transactionForm.addTransaction')}
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default Charts;
