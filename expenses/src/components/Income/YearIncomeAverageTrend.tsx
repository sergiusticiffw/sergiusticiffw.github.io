import React from 'react';
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
  return (
    <div className="income-summary-container">
      <HighchartsReact
        highcharts={Highcharts}
        options={yearIncomeAverageOptions}
      />
      
      <div className="income-summary-card">
        <div className="card-header">
          <h3 className="card-title">{t('income.totalIncomePerYear')}</h3>
          <div className="card-subtitle">Annual income vs spending analysis</div>
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
              {Object.entries(totalIncomePerYear).map((item, key) => {
                const income = item[1] as number;
                const spent = (totalPerYear[item[0]] as number) || 0;
                const diff: number = income - spent;
                const savingsPercent = (spent / income - 1) * -100;
                sumDiff += diff;
                sumIncome += income;
                const isPositive = diff > 0;
                
                return (
                  <div key={key} className="table-row">
                    <div className="table-cell year-cell">
                      <div className="year-content">
                        <div className="year-icon">
                          {getFinancialStabilityIcon(savingsPercent)}
                        </div>
                        <div className="year-label">{item[0]}</div>
                      </div>
                    </div>
                    <div className="table-cell income-cell">
                      <div className="amount-value income-value">{formatNumber(income)}</div>
                    </div>
                    <div className="table-cell spent-cell">
                      <div className="amount-value spent-value">{formatNumber(spent)}</div>
                    </div>
                    <div className="table-cell savings-cell">
                      <div className="savings-content">
                        <div className="savings-amount">{formatNumber(diff)}</div>
                        <div className="savings-percentage">
                          {isFinite(savingsPercent) ? `(${formatNumber(savingsPercent)}%)` : ''}
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
                      {getFinancialStabilityIcon((totalSpent / sumIncome - 1) * -100)}
                    </div>
                    <div className="year-label total-label">Total</div>
                  </div>
                </div>
                <div className="table-cell income-cell">
                  <div className="amount-value income-value total-amount">{formatNumber(sumIncome)}</div>
                </div>
                <div className="table-cell spent-cell">
                  <div className="amount-value spent-value total-amount">{formatNumber(totalSpent)}</div>
                </div>
                <div className="table-cell savings-cell">
                  <div className="savings-content">
                    <div className="savings-amount">{formatNumber(sumDiff)}</div>
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
