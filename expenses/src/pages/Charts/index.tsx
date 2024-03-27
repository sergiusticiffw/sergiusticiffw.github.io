import React, { Suspense, useEffect } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { fetchData } from '@utils/utils';
import Filters from '@components/Filters';
import { AuthState } from '@type/types';

const Charts = () => {
  const AllTimeSpendings = React.lazy(
    () => import('@components/AllTimeSpendings')
  );
  const MonthlyAverage = React.lazy(() => import('@components/MonthlyAverage'));
  const SavingsHistory = React.lazy(() => import('@components/SavingsHistory'));
  const DailyAverage = React.lazy(() => import('@components/DailyAverage'));
  const DailyAverageTrend = React.lazy(
    () => import('@components/DailyAverageTrend')
  );
  const LastTwoMonthsAverage = React.lazy(
    () => import('@components/LastTwoMonthsAverage')
  );
  const YearAverageTrend = React.lazy(
    () => import('@components/YearAverageTrend')
  );
  const MonthlyTotals = React.lazy(() => import('@components/MonthlyTotals'));
  const LastMonth = React.lazy(() => import('@components/LastMonth'));

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
              <Suspense fallback="">
                <MonthlyTotals />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <YearAverageTrend />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <LastMonth />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <AllTimeSpendings />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <MonthlyAverage />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <SavingsHistory />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <DailyAverage />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <DailyAverageTrend />
              </Suspense>
            </div>

            <div className="charts-section">
              <Suspense fallback="">
                <LastTwoMonthsAverage />
              </Suspense>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Charts;
