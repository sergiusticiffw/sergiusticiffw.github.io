import React, { useMemo } from 'react';
import { expenseStore, useExpenseChartView } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  calculateDaysFrom,
  formatDataForChart,
  formatNumber,
  getMonthsPassed,
} from '@shared/utils/utils';
import { getMonthNames } from '@shared/utils/constants';
import { getFinancialStabilityIcon } from '@shared/utils/helper';

const YearAverageTrend = () => {
  const view = useExpenseChartView();
  const raw = useStore(expenseStore, (s) => s.raw);
  const totalIncomePerYear =
    useStore(expenseStore, (s) => s.totalIncomePerYear) ?? {};
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const monthNames = getMonthNames();

  const items = view?.totalsPerYearAndMonth ?? null;
  const totalPerYear = view?.totalPerYear ?? {};
  const totalSpent = view?.totalSpent ?? 0;
  const formattedData = useMemo(
    () => formatDataForChart(items, false, monthNames, true),
    [items, monthNames]
  );

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: {
        type: 'line',
        zooming: { type: 'x' },
      },
      boost: { useGPUTranslations: true },
      title: { text: t('charts.yearsInReview') },
      xAxis: {
        type: 'category',
        categories: monthNames,
        crosshair: true,
      },
      yAxis: { title: { text: currency } },
      tooltip: { shared: true },
      credits: { enabled: false },
      series: formattedData as Highcharts.SeriesOptionsType[],
    }),
    [t, monthNames, currency, formattedData]
  );

  const firstDay = raw?.[raw.length - 1]?.dt;
  const monthlyAverage: number =
    firstDay && totalSpent
      ? totalSpent / getMonthsPassed(firstDay as string)
      : 0;
  let sumIncome = 0;
  const isFiltered = !!filteredRaw;
  const itms = Object.values(filteredRaw || raw || []).filter(
    (item: { type?: string }) => item.type === 'transaction'
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

export default React.memo(YearAverageTrend);
