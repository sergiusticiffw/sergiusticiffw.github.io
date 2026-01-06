import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  calculateDaysFrom,
  formatDataForChart,
  formatNumber,
  getMonthsPassed,
} from '@utils/utils';
import { getMonthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';

const YearAverageTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
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

  // Get localized month names
  const monthNames = getMonthNames();
  const formattedData = formatDataForChart(items, false, monthNames);

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
    series: formattedData as any,
  };
  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthlyAverage: number =
    totalSpent / getMonthsPassed(firstDay as string);
  const totalIncomePerYear = data?.totalIncomePerYear || {};
  let sumIncome: number = 0;
  const isFiltered = !!data.filtered_raw;
  const itms = Object.values(data.filtered_raw || data.raw).filter(
    (item) => item.type === 'transaction'
  );
  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <span className="heading">{t('charts.totalSpentPerYear')}:</span>
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
                {t('charts.totalSpent')}
              </div>
            </td>
            <td>{formatNumber(totalSpent)}</td>
          </tr>
          <tr>
            <td>{t('charts.totalDays')}</td>
            <td>
              {formatNumber(calculateDaysFrom(firstDay))} {t('charts.days')}
            </td>
          </tr>
          <tr>
            <td>{t('charts.totalMonths')}</td>
            <td>
              {getMonthsPassed(firstDay as string).toFixed(2)}{' '}
              {t('charts.months')}
            </td>
          </tr>
          <tr>
            <td>{t('charts.totalItems')}</td>
            <td>
              {formatNumber(itms.length)} {t('charts.items')}
            </td>
          </tr>
        </tbody>
      </table>
      <span className="heading">{t('charts.monthly')}</span>
      <table className="daily-average">
        <tbody>
          <tr>
            <td>{t('charts.monthlyAverage')}</td>
            <td>{formatNumber(monthlyAverage)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export default YearAverageTrend;
