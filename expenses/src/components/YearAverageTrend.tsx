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
  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <span className="heading">Total spent per year:</span>
      <table className="daily-average">
        <tbody>
        {Object.entries(totalPerYear).map((item, key) => {
          return (
            <tr key={key}>
              <td>{item[0]}</td>
              <td>
                {formatNumber(item[1])} {currency}
              </td>
            </tr>
          );
        })}
        <tr>
          <td>Total Spent</td>
          <td>
            {formatNumber(totalSpent)} {currency}
          </td>
        </tr>
        <tr>
          <td>Total Days</td>
          <td>{formatNumber(calculateDaysFrom(firstDay))} days</td>
        </tr>
        <tr>
          <td>Total Months</td>
          <td>{getMonthsPassed(firstDay as string)} months</td>
        </tr>
        </tbody>
      </table>
      <span className="heading">Monthly</span>
      <table className="daily-average">
        <tbody>
        <tr>
            <td>Monthly Average</td>
            <td>
              {formatNumber(monthlyAverage)} {currency}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export default YearAverageTrend;
