import React, { Suspense, useEffect } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { fetchData } from '@utils/utils';
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

const Charts = () => {
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const noEntries = Object.keys(data.raw).length === 0;
  const { token } = useAuthState() as AuthState;
  const loading = data.loading;
  const dispatch = useAuthDispatch();

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

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
            <div className="charts-section">
              <MonthlyTotals />
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <YearAverageTrend />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <MonthlyComparisonTrend />
              </Suspense>
            </div>

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <AllTimeSpendings />
                </Suspense>
              </div>
            )}

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <MonthlyAverage />
                </Suspense>
              </div>
            )}

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <SavingsHistory />
                </Suspense>
              </div>
            )}

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <MonthlySavingsTrend />
                </Suspense>
              </div>
            )}

            <div className="charts-section">
              <Suspense fallback="">
                <MonthlyAverageTrend />
              </Suspense>
            </div>

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <DailyAverage />
                </Suspense>
              </div>
            )}

            <div className="charts-section">
              <Suspense fallback="">
                <DailyAverageTrend />
              </Suspense>
            </div>

            {!data.filtered && (
              <div className="charts-section">
                <Suspense fallback="">
                  <LastTwoMonthsAverage />
                </Suspense>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default Charts;
