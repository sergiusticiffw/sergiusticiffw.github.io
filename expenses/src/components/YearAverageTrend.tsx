import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  calculateDaysFrom,
  formatDataForChart,
  formatNumber,
  getMonthsPassed,
} from '@utils/utils';
import { monthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';

const YearAverageTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const items =
    data?.filtered?.totalsPerYearAndMonth || data?.totalsPerYearAndMonth;
  const totalPerYear = data?.filtered?.totalPerYear || data?.totalPerYear;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [
    data?.totalsPerYearAndMonth,
    data?.filtered?.totalsPerYearAndMonth,
    data?.totalPerYear,
    data?.filtered?.totalPerYear,
  ]);

  const totalSpent = data.filtered?.totalSpent || data?.totalSpent;
  const formattedData = formatDataForChart(items);

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      zooming: {
        type: 'x',
      },
    },
    boost: {
      useGPUTranslations: true,
    },
    title: {
      text: 'Years in review',
    },
    xAxis: {
      type: 'category',
      categories: monthNames,
      crosshair: true,
    },
    yAxis: {
      title: {
        text: currency,
      },
    },
    tooltip: {
      shared: true,
    },
    credits: {
      enabled: false,
    },
    // @ts-expect-error fix the tsc.
    series: formattedData,
  };
  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthlyAverage: number =
    totalSpent / getMonthsPassed(firstDay as string);
  const totalIncomePerYear = data?.totalIncomePerYear || {};
  let sumIncome: number = 0;
  const isFiltered = !!data.filtered_raw;
  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <span className="heading">Total spent per year:</span>
      <table className="daily-average">
        <tbody>
          {Object.entries(totalPerYear).map((item, key) => {
            const savingsPercent =
              ((item[1] as number) / (totalIncomePerYear[item[0]] as number) -
                1) *
              -100;
            sumIncome += parseFloat(totalIncomePerYear[item[0]] as string);
            return (
              <tr key={key}>
                <td>
                  <div className="text-with-icon">
                    {getFinancialStabilityIcon(savingsPercent, isFiltered)}{' '}
                    {item[0]}
                  </div>
                </td>
                <td>{formatNumber(item[1])}</td>
              </tr>
            );
          })}
          <tr>
            <td>
              <div className="text-with-icon">
                {getFinancialStabilityIcon(
                  (totalSpent / sumIncome - 1) * -100,
                  isFiltered
                )}
                Total Spent
              </div>
            </td>
            <td>{formatNumber(totalSpent)}</td>
          </tr>
          <tr>
            <td>Total Days</td>
            <td>{formatNumber(calculateDaysFrom(firstDay))} days</td>
          </tr>
          <tr>
            <td>Total Months</td>
            <td>{getMonthsPassed(firstDay as string).toFixed(2)} months</td>
          </tr>
        </tbody>
      </table>
      <span className="heading">Monthly</span>
      <table className="daily-average">
        <tbody>
          <tr>
            <td>Monthly Average</td>
            <td>{formatNumber(monthlyAverage)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export default YearAverageTrend;
