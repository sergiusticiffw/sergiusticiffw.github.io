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
  getMonthsInRange,
  getMonthsPassed,
} from '@shared/utils/utils';
import { getMonthNames } from '@shared/utils/constants';
import { getFinancialStabilityIcon } from '@shared/utils/helper';
import {
  buildLogarithmicYAxisOptions,
  buildSharedCurrencyTooltipOptions,
  sanitizeCategorySeriesForLogScale,
} from '@shared/utils/highchartsHelpers';

const YearAverageTrend = () => {
  const view = useExpenseChartView();
  const raw = useStore(expenseStore, (s) => s.raw);
  const totalIncomePerYear = useStore(expenseStore, (s) => s.totalIncomePerYear) ?? {};
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const dateRange = useStore(expenseStore, (s) => s.dateRange);
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const monthNames = getMonthNames();

  const items = view?.totalsPerYearAndMonth ?? null;
  const totalPerYear = view?.totalPerYear ?? {};
  const totalSpent = view?.totalSpent ?? 0;
  const formattedData = useMemo(() => {
    const base = formatDataForChart(items, false, monthNames, true);
    return sanitizeCategorySeriesForLogScale(base);
  }, [items, monthNames]);

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
      yAxis: buildLogarithmicYAxisOptions(currency, formatNumber),
      tooltip: buildSharedCurrencyTooltipOptions(currency, formatNumber),
      credits: { enabled: false },
      series: formattedData as Highcharts.SeriesOptionsType[],
    }),
    [t, monthNames, currency, formattedData]
  );

  const firstDay = raw?.[raw.length - 1]?.dt;
  const monthsForAverage =
    dateRange?.start && dateRange?.end
      ? getMonthsInRange(dateRange.start, dateRange.end)
      : firstDay
        ? getMonthsPassed(firstDay as string)
        : 0;
  const monthlyAverage: number =
    totalSpent && monthsForAverage ? totalSpent / monthsForAverage : 0;
  let sumIncome = 0;
  const isFiltered = !!filteredRaw;
  const itms = Object.values(filteredRaw || raw || []).filter(
    (item: { type?: string }) => item.type === 'transaction'
  );
  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <span className="block text-[#e0e0e3] text-xl uppercase tracking-wide mt-5 mb-4 font-semibold text-center">
        {t('charts.totalSpentPerYear')}:
      </span>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            {Object.entries(totalPerYear).map((item, key) => {
              const savingsPercent =
                ((item[1] as number) / (totalIncomePerYear[item[0]] as number) -
                  1) *
                -100;
              sumIncome += parseFloat(totalIncomePerYear[item[0]] as string);
              return (
                <tr
                  key={key}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="py-3 px-4 text-white font-medium text-[0.95rem] align-middle">
                    <div className="flex items-center gap-2">
                      {getFinancialStabilityIcon(savingsPercent, isFiltered)}{' '}
                      <span>{item[0]}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                    {formatNumber(item[1])}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] bg-white/[0.02]">
              <td className="py-3 px-4 text-white font-medium text-[0.95rem] align-middle">
                <div className="flex items-center gap-2">
                  {getFinancialStabilityIcon(
                    (totalSpent / sumIncome - 1) * -100,
                    isFiltered
                  )}
                  <span>{t('charts.totalSpent')}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-right text-white font-semibold text-[0.95rem] tabular-nums align-middle">
                {formatNumber(totalSpent)}
              </td>
            </tr>
            <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
              <td className="py-3 px-4 text-white/90 font-medium text-[0.95rem] align-middle">
                {t('charts.totalDays')}
              </td>
              <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                {formatNumber(calculateDaysFrom(firstDay))} {t('charts.days')}
              </td>
            </tr>
            <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
              <td className="py-3 px-4 text-white/90 font-medium text-[0.95rem] align-middle">
                {t('charts.totalMonths')}
              </td>
              <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                {(dateRange?.start && dateRange?.end
                  ? getMonthsInRange(dateRange.start, dateRange.end)
                  : getMonthsPassed(firstDay as string)
                ).toFixed(2)}{' '}
                {t('charts.months')}
              </td>
            </tr>
            <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
              <td className="py-3 px-4 text-white/90 font-medium text-[0.95rem] align-middle">
                {t('charts.totalItems')}
              </td>
              <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                {formatNumber(itms.length)} {t('charts.items')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <span className="block text-[#e0e0e3] text-xl uppercase tracking-wide mt-6 mb-4 font-semibold text-center">
        {t('charts.monthly')}
      </span>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            <tr className="hover:bg-white/[0.02]">
              <td className="py-3 px-4 text-white/90 font-medium text-[0.95rem] align-middle">
                {t('charts.monthlyAverage')}
              </td>
              <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                {formatNumber(monthlyAverage)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
};

export default React.memo(YearAverageTrend);
