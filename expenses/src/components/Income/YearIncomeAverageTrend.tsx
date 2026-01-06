import React, { useState } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { formatDataForChart, formatNumber } from '@utils/utils';
import { getMonthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';
import './YearIncomeAverageTrend.scss';

const YearIncomeAverageTrend: React.FC = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
  const [clickedCells, setClickedCells] = useState<Set<string>>(new Set());

  const totalIncomePerYear = data?.totalIncomePerYear || {};
  const totalPerYear = data?.totalPerYear || {};
  const totalSpent = data?.totalSpent || 0;

  // Get localized month names
  const monthNames = getMonthNames();
  const formattedIncomeData = formatDataForChart(
    data?.totalIncomePerYearAndMonth || {},
    false,
    monthNames
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
      text: t('charts.yearsInReview'),
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

  // Sort years to calculate percentage changes correctly
  const sortedYears = Object.keys(totalIncomePerYear).sort((a, b) =>
    parseInt(a) - parseInt(b)
  );

  // Helper function to calculate percentage change
  const calculatePercentageChange = (
    current: number,
    previous: number
  ): number | null => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  // Helper function to format percentage change with color
  const formatPercentageChange = (
    percent: number | null,
    isSpent: boolean = false
  ): React.ReactNode => {
    if (percent === null) return null;
    const sign = percent >= 0 ? '+' : '';
    // For Spent column: positive % (spent more) = RED, negative % (spent less) = GREEN
    // For Income column: positive % (earned more) = GREEN, negative % (earned less) = RED
    let color: string;
    if (isSpent) {
      color = percent >= 0 ? '#f87171' : '#4ade80'; // Inverted for spent
    } else {
      color = percent >= 0 ? '#4ade80' : '#f87171'; // Normal for income
    }
    return (
      <span style={{ color }}> ({sign}{formatNumber(percent)}%)</span>
    );
  };

  // Toggle cell click state
  const toggleCell = (cellId: string) => {
    setClickedCells((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      return newSet;
    });
  };

  return (
    <div className="income-summary-container">
      <HighchartsReact
        highcharts={Highcharts}
        options={yearIncomeAverageOptions}
      />

      <div className="income-summary-card">
        <div className="card-header">
          <h3 className="card-title">{t('income.totalIncomePerYear')}</h3>
          <div className="card-subtitle">
            Annual income vs spending analysis
          </div>
        </div>

        <div className="card-content">
          <div className="income-table-wrapper">
            <div className="table-header">
              <div className="header-cell year-header">{t('income.year')}</div>
              <div className="header-cell">{t('common.income')}</div>
              <div className="header-cell">{t('income.spent')}</div>
              <div className="header-cell">{t('income.savings')}</div>
            </div>

            <div className="table-body">
              {sortedYears.map((year, key) => {
                const income = totalIncomePerYear[year] as number;
                const spent = (totalPerYear[year] as number) || 0;
                const diff: number = income - spent;
                const savingsPercent = (spent / income - 1) * -100;
                sumDiff += diff;
                sumIncome += income;

                // Get previous year's values for percentage calculation
                const prevYearIndex = key - 1;
                const prevYear =
                  prevYearIndex >= 0 ? sortedYears[prevYearIndex] : null;
                const prevIncome = prevYear
                  ? (totalIncomePerYear[prevYear] as number)
                  : null;
                const prevSpent = prevYear
                  ? ((totalPerYear[prevYear] as number) || 0)
                  : null;

                const incomeChange =
                  prevIncome !== null
                    ? calculatePercentageChange(income, prevIncome)
                    : null;
                const spentChange =
                  prevSpent !== null
                    ? calculatePercentageChange(spent, prevSpent)
                    : null;

                const incomeCellId = `income-${year}`;
                const spentCellId = `spent-${year}`;
                const showIncomeChange = clickedCells.has(incomeCellId);
                const showSpentChange = clickedCells.has(spentCellId);

                return (
                  <div key={key} className="table-row">
                    <div className="table-cell year-cell">
                      <div className="year-content">
                        <div className="year-icon">
                          {getFinancialStabilityIcon(savingsPercent)}
                        </div>
                        <div className="year-label">{year}</div>
                      </div>
                    </div>
                    <div className="table-cell income-cell">
                      <div
                        className="amount-value income-value"
                        onClick={() => toggleCell(incomeCellId)}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {formatNumber(income)}
                        {showIncomeChange &&
                          formatPercentageChange(incomeChange, false)}
                      </div>
                    </div>
                    <div className="table-cell spent-cell">
                      <div
                        className="amount-value spent-value"
                        onClick={() => toggleCell(spentCellId)}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {formatNumber(spent)}
                        {showSpentChange &&
                          formatPercentageChange(spentChange, true)}
                      </div>
                    </div>
                    <div className="table-cell savings-cell">
                      <div className="savings-content">
                        <div className="savings-amount">
                          {formatNumber(diff)}
                        </div>
                        <div className="savings-percentage">
                          {isFinite(savingsPercent)
                            ? `(${formatNumber(savingsPercent)}%)`
                            : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="table-row total-row">
                <div className="table-cell year-cell">
                  <div className="year-content">
                    <div className="year-icon">
                      {getFinancialStabilityIcon(
                        (totalSpent / sumIncome - 1) * -100
                      )}
                    </div>
                    <div className="year-label total-label">Total</div>
                  </div>
                </div>
                <div className="table-cell income-cell">
                  <div className="amount-value income-value total-amount">
                    {formatNumber(sumIncome)}
                  </div>
                </div>
                <div className="table-cell spent-cell">
                  <div className="amount-value spent-value total-amount">
                    {formatNumber(totalSpent)}
                  </div>
                </div>
                <div className="table-cell savings-cell">
                  <div className="savings-content">
                    <div className="savings-amount">
                      {formatNumber(sumDiff)}
                    </div>
                    <div className="savings-percentage">
                      ({formatNumber((totalSpent / sumIncome - 1) * -100)}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearIncomeAverageTrend;
