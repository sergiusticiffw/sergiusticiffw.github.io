import React, { useMemo, useState } from 'react';
import { expenseStore, useExpenseChartView } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { FiChevronDown } from 'react-icons/fi';
import {
  calculateDaysFrom,
  formatDataForChart,
  formatNumber,
  getDaysInRange,
  getMonthsInRange,
  getMonthsPassed,
} from '@shared/utils/utils';
import { getCategories, getMonthNames } from '@shared/utils/constants';
import { getFinancialStabilityIcon } from '@shared/utils/helper';
import {
  buildLogarithmicYAxisOptions,
  buildSharedCurrencyTooltipOptions,
  sanitizeCategorySeriesForLogScale,
} from '@shared/utils/highchartsHelpers';
import type { TransactionOrIncomeItem } from '@shared/type/types';

type PiePoint = { name: string; y: number };

const YearCategoryPie = ({
  data,
  currency,
}: {
  data: PiePoint[];
  currency: string;
}) => {
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        height: 260,
      },
      title: {
        text: undefined,
      },
      tooltip: {
        pointFormat: `{point.y:,.2f} {series.name} ({point.percentage:.1f}%)`,
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          innerSize: '70%',
          dataLabels: { enabled: false },
          showInLegend: false,
        },
      },
      legend: { enabled: false },
      series: [
        {
          name: currency,
          type: 'pie',
          data,
        },
      ],
      credits: { enabled: false },
    }),
    [currency, data]
  );

  if (!data.length) return null;

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

const YearAverageTrend = () => {
  const view = useExpenseChartView();
  const raw = useStore(expenseStore, (s) => s.raw);
  const totalIncomePerYear =
    useStore(expenseStore, (s) => s.totalIncomePerYear) ?? {};
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const dateRange = useStore(expenseStore, (s) => s.dateRange);
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const monthNames = getMonthNames();
  const localizedCategories = getCategories();
  const [openYear, setOpenYear] = useState<string | null>(null);

  const items = view?.totalsPerYearAndMonth ?? null;
  const totalPerYear = view?.totalPerYear ?? {};
  const totalSpent = view?.totalSpent ?? 0;
  const formattedData = useMemo(() => {
    const base = formatDataForChart(items, false, monthNames, true);
    return sanitizeCategorySeriesForLogScale(base);
  }, [items, monthNames]);

  const categoryLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    localizedCategories.forEach((cat) => {
      map[cat.value] = cat.label;
    });
    return map;
  }, [localizedCategories]);

  const categoryPieByYear = useMemo(() => {
    const source =
      (filteredRaw as TransactionOrIncomeItem[] | undefined) ??
      (raw as TransactionOrIncomeItem[] | undefined) ??
      [];

    const byYear: Record<string, Record<string, number>> = {};

    source.forEach((item) => {
      if (item.type !== 'transaction' || !item.dt || !item.cat) return;
      const year = String(new Date(item.dt).getFullYear());
      if (!byYear[year]) byYear[year] = {};
      byYear[year][item.cat] =
        (byYear[year][item.cat] || 0) + (parseFloat(item.sum) || 0);
    });

    const result: Record<string, PiePoint[]> = {};
    Object.entries(byYear).forEach(([year, cats]) => {
      result[year] = Object.entries(cats)
        .map(([catId, y]) => ({
          name: categoryLabelById[catId] || catId,
          y: parseFloat(y.toFixed(2)),
        }))
        .filter((p) => p.y > 0)
        .sort((a, b) => b.y - a.y);
    });
    return result;
  }, [raw, filteredRaw, categoryLabelById]);

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

  const toggleYear = (year: string) => {
    setOpenYear((prev) => (prev === year ? null : year));
  };

  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <span className="block text-[#e0e0e3] text-xl uppercase tracking-wide mt-5 mb-4 font-semibold text-center">
        {t('charts.totalSpentPerYear')}:
      </span>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            {Object.entries(totalPerYear).map(([year, amount]) => {
              const savingsPercent =
                ((amount as number) / (totalIncomePerYear[year] as number) -
                  1) *
                -100;
              sumIncome += parseFloat(totalIncomePerYear[year] as string);
              const isOpen = openYear === year;
              const pieData = categoryPieByYear[year] ?? [];
              return (
                <React.Fragment key={year}>
                  <tr
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => toggleYear(year)}
                    aria-expanded={isOpen}
                  >
                    <td className="py-3 px-4 text-white font-medium text-[0.95rem] align-middle">
                      <div className="flex items-center gap-2">
                        {getFinancialStabilityIcon(savingsPercent, isFiltered)}{' '}
                        <span>{year}</span>
                        <FiChevronDown
                          className={`text-white/50 shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-medium text-[0.95rem] tabular-nums align-middle">
                      {formatNumber(amount)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-white/5">
                      <td colSpan={2} className="px-2 pb-3 pt-0">
                        <YearCategoryPie data={pieData} currency={currency} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
                {formatNumber(
                  dateRange?.start && dateRange?.end
                    ? getDaysInRange(dateRange.start, dateRange.end)
                    : calculateDaysFrom(firstDay)
                )}{' '}
                {t('charts.days')}
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
