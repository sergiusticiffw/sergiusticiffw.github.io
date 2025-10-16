import React, { Suspense, useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { fetchData } from '@utils/utils';
import { availableCharts } from '@utils/constants';
import { getCategories } from '@utils/constants';
import SearchBar from '@components/SearchBar/SearchBar';
import Modal from '@components/Modal';
import TransactionForm from '@components/TransactionForm';
import { AuthState } from '@type/types';
import { FaPlus } from 'react-icons/fa';
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
  const noEntries = Object.keys(data.raw).length === 0;
  const { token } = useAuthState() as AuthState;
  const loading = data.loading;
  const dispatch = useAuthDispatch();

  const [visibleCharts, setVisibleCharts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchText, setSearchText] = useState(data.textFilter ?? '');
  const [selectedCategory, setSelectedCategory] = useState(data.category ?? '');

  const categoryLabels = getCategories();

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  useEffect(() => {
    const storedCharts =
      JSON.parse(localStorage.getItem('visibleCharts')) || availableCharts;
    setVisibleCharts(storedCharts);
  }, []);

  // Update filters in context
  useEffect(() => {
    dataDispatch({
      type: 'FILTER_DATA',
      category: selectedCategory,
      textFilter: searchText,
    });
  }, [searchText, selectedCategory, dataDispatch]);

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

      {loading ? (
        <div className="charts-loading">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      ) : (
        !noEntries && (
          <div className="charts-content">
            {visibleCharts.map((chartKey) => {
              const ChartComponent = componentMap[chartKey];
              return ChartComponent ? (
                <div key={chartKey} className="charts-section">
                  <Suspense fallback="">
                    <ChartComponent />
                  </Suspense>
                </div>
              ) : null;
            })}
          </div>
        )
      )}

      {/* Add Transaction Modal */}
      <Modal
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
        title={t('transactionForm.addTransaction')}
      >
        <TransactionForm
          formType="add"
          values={{}}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        title={t('transactionForm.addTransaction')}
      >
        <FaPlus />
      </button>
    </div>
  );
};

export default Charts;
