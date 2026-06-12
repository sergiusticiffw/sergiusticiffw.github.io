import React, { useMemo } from 'react';
import { expenseStore, useExpenseChartView } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@shared/utils/constants';
import { formatMonth, parseMonthString } from '@shared/utils/utils';

const ENGLISH_MONTH_NAMES = [
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
] as const;

const MonthlyTotals = () => {
  const totals = useExpenseChartView()?.totals;
  const raw = useStore(expenseStore, (s) => s.raw);
  const category = useStore(expenseStore, (s) => s.category);
  const incomeTotals = useStore(expenseStore, (s) => s.incomeTotals);
  const filterKey = useStore(
    expenseStore,
    (s) =>
      `${s.category}|${s.textFilter}|${s.selectedTag}|${s.dateRange?.start ?? ''}|${s.dateRange?.end ?? ''}`
  );
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const categories = getCategories();

  const allTimeOptions: Highcharts.Options | null = useMemo(() => {
    if (!raw?.length) return null;

    const firstDay = new Date(raw[raw.length - 1].dt);
    const lastDay = new Date(raw[0].dt);
    const monthlyTotals: Record<string, number> = {};
    const allMonths: string[] = [];

    const cursor = new Date(
      firstDay.getUTCFullYear(),
      firstDay.getUTCMonth(),
      1
    );
    while (cursor <= lastDay) {
      const formattedDate = formatMonth(cursor);
      allMonths.push(formattedDate);
      monthlyTotals[formattedDate] = 0;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (totals) {
      Object.keys(totals).forEach((month) => {
        const monthDate = parseMonthString(month);
        if (monthDate) {
          const formattedMonth = formatMonth(monthDate);
          monthlyTotals[formattedMonth] = totals[month];
        }
      });
    }

    const seriesData = allMonths.map((month) => monthlyTotals[month] || 0);
    const incomeData = allMonths.map((formattedMonth) => {
      const monthDate = parseMonthString(formattedMonth);
      if (!monthDate || !incomeTotals) return 0;
      const englishKey = `${ENGLISH_MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
      return incomeTotals[englishKey] ?? 0;
    });

    const pointStart = Date.UTC(
      firstDay.getUTCFullYear(),
      firstDay.getMonth(),
      1
    );

    return {
      chart: {
        type: 'column',
        zooming: { type: 'x' },
      },
      title: { text: t('charts.monthlyTotals') },
      yAxis: {
        min: 0,
        title: { text: currency },
      },
      plotOptions: {
        column: {
          pointPadding: 0.2,
          borderWidth: 0,
          stacking: 'normal',
          groupPadding: 0,
        },
      },
      credits: { enabled: false },
      tooltip: { shared: true },
      series: [
        {
          id: 'monthly-expenses',
          type: 'column',
          name: category
            ? categories.find((c) => c.value === category)?.label
            : t('charts.monthlyTotals'),
          data: seriesData,
          colorByPoint: true,
          pointIntervalUnit: 'month',
          pointStart,
        },
        {
          id: 'monthly-income',
          type: 'spline',
          name: t('common.income'),
          pointIntervalUnit: 'month',
          pointStart,
          color: '#4DD0E1',
          visible: false,
          data: incomeData,
        },
      ],
      legend: { enabled: true },
      rangeSelector: { selected: 4 },
    };
    // categories read from closure; not in deps (new array reference every render)
  }, [raw, totals, category, incomeTotals, currency, t]);

  if (!allTimeOptions) return null;

  return (
    <HighchartsReact
      key={filterKey}
      immutable
      highcharts={Highcharts}
      constructorType="stockChart"
      options={allTimeOptions}
    />
  );
};

export default React.memo(MonthlyTotals);
