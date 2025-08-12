import React from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { formatDataForChart, formatNumber } from '@utils/utils';
import { monthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';
import './YearIncomeAverageTrend.scss';

const YearIncomeAverageTrend: React.FC = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  const totalIncomePerYear = data?.totalIncomePerYear || {};
  const totalPerYear = data?.totalPerYear || {};
  const totalSpent = data?.totalSpent || 0;

  const formattedIncomeData = formatDataForChart(
    data?.totalIncomePerYearAndMonth || {}
  );

  const yearIncomeAverageOptions: Highcharts.Options = {
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
    series: formattedIncomeData as any,
  };

  let sumDiff: number = 0;
  let sumIncome: number = 0;
  return (
    <>
      <HighchartsReact
        highcharts={Highcharts}
        options={yearIncomeAverageOptions}
      />
      <div className="year-income-average-balanced">
        <div className="section-header">
          <h3>Total Income Per Year</h3>
        </div>

        <table className="balanced-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Income</th>
              <th>Spent</th>
              <th>Savings</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(totalIncomePerYear).map((item, key) => {
              const income = item[1] as number;
              const spent = (totalPerYear[item[0]] as number) || 0;
              const diff: number = income - spent;
              const savingsPercent = (spent / income - 1) * -100;
              sumDiff += diff;
              sumIncome += income;
              return (
                <tr key={key}>
                  <td className="year-cell">
                    <div className="text-with-icon">
                      {getFinancialStabilityIcon(savingsPercent)}
                      <span className="year-name">{item[0]}</span>
                    </div>
                  </td>
                  <td className="amount-cell">{formatNumber(income)}</td>
                  <td className="amount-cell">{formatNumber(spent)}</td>
                  <td className="amount-cell">
                    {isFinite(savingsPercent)
                      ? `${formatNumber(diff)} (${formatNumber(savingsPercent)}%)`
                      : `${formatNumber(diff)}`}
                  </td>
                </tr>
              );
            })}
            <tr className="total-row">
              <td className="total-label">
                <div className="text-with-icon">
                  {getFinancialStabilityIcon(
                    (totalSpent / sumIncome - 1) * -100
                  )}
                  <span>Total</span>
                </div>
              </td>
              <td className="total-amount">{formatNumber(sumIncome)}</td>
              <td className="total-amount">{formatNumber(totalSpent)}</td>
              <td className="total-amount">
                {formatNumber(sumDiff)} (
                {formatNumber((totalSpent / sumIncome - 1) * -100)}
                %)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
};

export default YearIncomeAverageTrend;
