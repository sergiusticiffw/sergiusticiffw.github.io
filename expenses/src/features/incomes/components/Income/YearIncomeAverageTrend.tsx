import React, { useState, useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { formatDataForChart, formatNumber } from '@shared/utils/utils';
import { getMonthNames } from '@shared/utils/constants';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { getFinancialStabilityIcon } from '@shared/utils/helper';
import {
  buildLogarithmicYAxisOptions,
  buildSharedCurrencyTooltipOptions,
  sanitizeCategorySeriesForLogScale,
} from '@shared/utils/highchartsHelpers';

interface YearIncomeAverageTrendProps {
  filteredIncomeData?: TransactionOrIncomeItem[];
  isFiltered?: boolean;
}

const YearIncomeAverageTrend: React.FC<YearIncomeAverageTrendProps> = ({
  filteredIncomeData,
  isFiltered = false,
}) => {
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const [clickedCells, setClickedCells] = useState<Set<string>>(new Set());

  // Calculate totals from filtered data if provided, otherwise use all data
  const {
    totalIncomePerYear,
    totalPerYear,
    totalSpent,
    totalIncomePerYearAndMonth,
  } = useMemo(() => {
    // Use filtered data if provided, otherwise use all data
    const incomeData =
      filteredIncomeData !== undefined
        ? filteredIncomeData
        : data.incomeData || [];
    const transactionData = (data.raw || []).filter(
      (item: TransactionOrIncomeItem) => item.type === 'transaction'
    );

    const totals: {
      totalIncomePerYear: Record<string, number>;
      totalPerYear: Record<string, number>;
      totalSpent: number;
      totalIncomePerYearAndMonth: Record<string, Record<string, number>>;
    } = {
      totalIncomePerYear: {},
      totalPerYear: {},
      totalSpent: 0,
      totalIncomePerYearAndMonth: {},
    };

    // Process income data
    // English month names (must match formatDataForChart expectations)
    const englishMonthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    incomeData.forEach((item: TransactionOrIncomeItem) => {
      if (!item.dt) return;
      const date = new Date(item.dt);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth();
      // Use month name format like "January 2024" to match formatDataForChart expectations
      const monthKey = `${englishMonthNames[month]} ${year}`;

      if (!totals.totalIncomePerYear[year]) {
        totals.totalIncomePerYear[year] = 0;
      }
      if (!totals.totalIncomePerYearAndMonth[year]) {
        totals.totalIncomePerYearAndMonth[year] = {};
      }
      if (!totals.totalIncomePerYearAndMonth[year][monthKey]) {
        totals.totalIncomePerYearAndMonth[year][monthKey] = 0;
      }

      const amount = parseFloat(item.sum || '0');
      totals.totalIncomePerYear[year] += amount;
      totals.totalIncomePerYearAndMonth[year][monthKey] += amount;
    });

    // Process transaction data
    transactionData.forEach((item: TransactionOrIncomeItem) => {
      if (!item.dt) return;
      const date = new Date(item.dt);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();

      if (!totals.totalPerYear[year]) {
        totals.totalPerYear[year] = 0;
      }

      const amount = parseFloat(item.sum || '0');
      totals.totalPerYear[year] += amount;
      totals.totalSpent += amount;
    });

    return totals;
  }, [filteredIncomeData, data.incomeData, data.raw]);

  // Get localized month names - must be called unconditionally (getMonthNames uses useLocalization hook)
  const monthNames = getMonthNames();
  const formattedIncomeData = useMemo(() => {
    const base = formatDataForChart(
      totalIncomePerYearAndMonth,
      false,
      monthNames,
      true
    );
    return sanitizeCategorySeriesForLogScale(base);
  }, [totalIncomePerYearAndMonth, monthNames]);

  const yearIncomeAverageOptions: Highcharts.Options = useMemo(
    () => ({
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
      yAxis: buildLogarithmicYAxisOptions(currency, formatNumber),
      tooltip: buildSharedCurrencyTooltipOptions(currency, formatNumber),
      credits: {
        enabled: false,
      },
      series: formattedIncomeData as any,
    }),
    [t, monthNames, currency, formattedIncomeData]
  );

  let sumDiff: number = 0;
  let sumIncome: number = 0;

  // Sort years to calculate percentage changes correctly
  const sortedYears = Object.keys(totalIncomePerYear).sort(
    (a, b) => parseInt(a) - parseInt(b)
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
      <span style={{ color }}>
        {' '}
        ({sign}
        {formatNumber(percent)}%)
      </span>
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

  const tableWrapper =
    'overflow-hidden w-full';
  const tableRow =
    'hover:bg-white/[0.02]';
  const cellLeft =
    'py-3 px-3 sm:px-4 text-white font-medium text-[0.9rem] sm:text-[0.95rem] align-middle';
  const cellRight =
    'py-3 px-3 sm:px-4 text-right text-white font-medium text-[0.9rem] sm:text-[0.95rem] tabular-nums align-middle';
  const headerCellLeft =
    'py-3 px-3 sm:px-4 text-white/60 text-xs font-bold uppercase tracking-wider align-middle';
  const headerCellRight =
    'py-3 px-3 sm:px-4 text-right text-white/60 text-xs font-bold uppercase tracking-wider align-middle';

  return (
    <div className="mt-6 w-full min-w-0 max-w-full -mx-1 sm:-mx-2 md:-mx-3">
      <HighchartsReact
        highcharts={Highcharts}
        options={yearIncomeAverageOptions}
      />

      <span className="block text-[#e0e0e3] text-xl uppercase tracking-wide mt-5 mb-4 font-semibold text-center">
        {t('income.totalIncomePerYear')}:
      </span>
      <div
        className="w-full min-w-0 overflow-x-auto sm:overflow-visible"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className={tableWrapper}>
        <table className="w-full min-w-[320px] sm:min-w-0 border-collapse sm:table-auto">
          <colgroup>
            <col className="w-[14%] sm:w-auto" />
            <col className="w-[28%] sm:w-auto" />
            {!isFiltered && (
              <>
                <col className="w-[28%] sm:w-auto" />
                <col className="w-[30%] sm:w-auto" />
              </>
            )}
          </colgroup>
          <thead>
            <tr className={tableRow}>
              <th className={headerCellLeft}>{t('income.year')}</th>
              <th className={headerCellRight}>{t('common.income')}</th>
              {!isFiltered && (
                <>
                  <th className={headerCellRight}>{t('income.spent')}</th>
                  <th className={headerCellRight}>{t('income.savings')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedYears.map((year, key) => {
              const income = totalIncomePerYear[year] as number;
              const spent = (totalPerYear[year] as number) || 0;
              const diff: number = income - spent;
              const savingsPercent = (spent / income - 1) * -100;
              if (!isFiltered) {
                sumDiff += diff;
              }
              sumIncome += income;

              const prevYearIndex = key - 1;
              const prevYear =
                prevYearIndex >= 0 ? sortedYears[prevYearIndex] : null;
              const prevIncome = prevYear
                ? (totalIncomePerYear[prevYear] as number)
                : null;
              const prevSpent = prevYear
                ? (totalPerYear[prevYear] as number) || 0
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
                <tr key={key} className={tableRow}>
                  <td className={cellLeft}>
                    <div className="flex items-center gap-2">
                      {!isFiltered &&
                        getFinancialStabilityIcon(savingsPercent)}
                      <span>{year}</span>
                    </div>
                  </td>
                  <td
                    className={`${cellRight} cursor-pointer select-none`}
                    onClick={() => toggleCell(incomeCellId)}
                  >
                    {formatNumber(income)}
                    {!isFiltered &&
                      showIncomeChange &&
                      formatPercentageChange(incomeChange, false)}
                  </td>
                  {!isFiltered && (
                    <>
                      <td
                        className={`${cellRight} cursor-pointer select-none`}
                        onClick={() => toggleCell(spentCellId)}
                      >
                        {formatNumber(spent)}
                        {showSpentChange &&
                          formatPercentageChange(spentChange, true)}
                      </td>
                      <td className={cellRight}>
                        <div className="flex flex-col items-end">
                          <span
                            className={
                              diff < 0 ? 'text-red-400 font-semibold' : ''
                            }
                          >
                            {formatNumber(diff)}
                          </span>
                          {isFinite(savingsPercent) && (
                            <span
                              className={`text-[0.8rem] ${
                                diff < 0 ? 'text-red-400' : 'text-white/70'
                              }`}
                            >
                              ({formatNumber(savingsPercent)}%)
                            </span>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!isFiltered && (
              <tr className={`${tableRow} bg-white/[0.02]`}>
                <td className={cellLeft}>
                  <div className="flex items-center gap-2">
                    {getFinancialStabilityIcon(
                      (totalSpent / sumIncome - 1) * -100
                    )}
                    <span className="font-semibold uppercase tracking-wide">
                      {t('common.total')}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-white font-semibold text-[0.95rem] tabular-nums align-middle">
                  {formatNumber(sumIncome)}
                </td>
                <td className="py-3 px-4 text-right text-white font-semibold text-[0.95rem] tabular-nums align-middle">
                  {formatNumber(totalSpent)}
                </td>
                <td className="py-3 px-4 text-right align-middle">
                  <div className="flex flex-col items-end">
                    <span
                      className={
                        sumDiff < 0
                          ? 'text-red-400 font-semibold text-[0.95rem]'
                          : 'text-white font-semibold text-[0.95rem]'
                      }
                    >
                      {formatNumber(sumDiff)}
                    </span>
                    <span
                      className={
                        sumDiff < 0
                          ? 'text-red-400 text-[0.8rem]'
                          : 'text-white/70 text-[0.8rem]'
                      }
                    >
                      ({formatNumber((totalSpent / sumIncome - 1) * -100)}%)
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default YearIncomeAverageTrend;
