import React from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { formatDataForChart, formatNumber } from '@utils/utils';
import { monthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';

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
      <div className="income-table-container">
        <div className="table-header">
          <h3>Total income per year</h3>
        </div>

        <div className="table-wrapper">
          <table className="income-table" cellSpacing="0" cellPadding="0">
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
                    <td>
                      <div className="text-with-icon">
                        {getFinancialStabilityIcon(savingsPercent)}
                        {item[0]}
                      </div>
                    </td>
                    <td>{formatNumber(income)}</td>
                    <td>{formatNumber(spent)}</td>
                    <td>
                      {isFinite(savingsPercent)
                        ? `${formatNumber(diff)} (${formatNumber(savingsPercent)}%)`
                        : `${formatNumber(diff)}`}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <div className="text-with-icon">
                    {getFinancialStabilityIcon(
                      (totalSpent / sumIncome - 1) * -100
                    )}
                    Total
                  </div>
                </td>
                <td>{formatNumber(sumIncome)}</td>
                <td>{formatNumber(totalSpent)}</td>
                <td>
                  {formatNumber(sumDiff)} (
                  {formatNumber((totalSpent / sumIncome - 1) * -100)}
                  %)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default YearIncomeAverageTrend;
