import React, { Suspense, useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { fetchData } from '@utils/utils';
import { availableCharts } from '@utils/constants';
import Filters from '@components/Filters/Filters';
import { AuthState } from '@type/types';
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

  return (
    <div>
      <h2>{t('charts.title')}</h2>
      <Filters />
      {loading ? (
        <div className="loading-container">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      ) : (
        !noEntries && (
          <div className="charts-page">
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
    </div>
  );
};

export default Charts;
