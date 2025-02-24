import React, { Suspense, useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { fetchData } from '@utils/utils';
import { availableCharts } from '@utils/constants';
import Filters from '@components/Filters';
import { AuthState } from '@type/types';
import MonthlySavingsTrend from '@components/MonthlySavingsTrend';
import MonthlyTotals from '@components/MonthlyTotals';
import YearAverageTrend from '@components/YearAverageTrend';
import MonthlyComparisonTrend from '@components/MonthlyComparisonTrend';
import AllTimeSpendings from '@components/AllTimeSpendings';
import MonthlyAverage from '@components/MonthlyAverage';
import SavingsHistory from '@components/SavingsHistory';
import MonthlyAverageTrend from '@components/MonthlyAverageTrend';
import DailyAverage from '@components/DailyAverage';
import DailyAverageTrend from '@components/DailyAverageTrend';
import LastTwoMonthsAverage from '@components/LastTwoMonthsAverage';

const componentMap = {
  MonthlyTotals,
  YearAverageTrend,
  MonthlyComparisonTrend,
  AllTimeSpendings,
  MonthlyAverage,
  SavingsHistory,
  MonthlySavingsTrend,
  MonthlyAverageTrend,
  DailyAverage,
  DailyAverageTrend,
  LastTwoMonthsAverage,
};

const Charts = () => {
  const { data, dataDispatch } = useData();
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
      <h2>Charts page</h2>
      <Filters />
      {loading ? (
        <div className="lds-ripple">
          <div></div>
          <div></div>
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
