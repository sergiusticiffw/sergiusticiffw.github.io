import React, { useMemo } from 'react';
import { expenseStore, useExpenseChartView } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@shared/utils/constants';
import { formatMonth, parseMonthString } from '@shared/utils/utils';

const MonthlyTotals = () => {
  const view = useExpenseChartView();
  const raw = useStore(expenseStore, (s) => s.raw);
  const category = useStore(expenseStore, (s) => s.category);
  const incomeTotals = useStore(expenseStore, (s) => s.incomeTotals);
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const categories = getCategories();

  if (!raw?.length) return null;

  const items = view;

  const firstDay = new Date(raw[raw.length - 1]?.dt ?? '');
  const lastDay = new Date(raw[0]?.dt ?? '');

  // Initialize monthly totals with all months from the firstDay to the lastDay.
  let monthlyTotals: { [key: string]: number } = {};

  // Function to generate all months between the first and last date.
  const generateAllMonths = (startDate: Date, endDate: Date) => {
    const months = [];
    const date = new Date(startDate);

    while (date <= endDate) {
      const formattedDate = formatMonth(date);
      months.push(formattedDate);
      monthlyTotals[formattedDate] = 0; // Initialize with zero
      date.setMonth(date.getMonth() + 1);
    }
    return months;
  };

  // Generate months between first and last transaction
  const allMonths = generateAllMonths(
    new Date(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
    lastDay
  );
  // Now fill in the totals for the available months
  items.totals &&
    Object.keys(items.totals).forEach((month) => {
      // Parse the month string (e.g., "January 2024") to Date
      // Safari is stricter with Date parsing, so we use a helper function
      const monthDate = parseMonthString(month);

      if (monthDate) {
        const formattedMonth = formatMonth(monthDate);
        monthlyTotals[formattedMonth] = items.totals[month];
      }
    });

  const seriesData = allMonths.map((month) => monthlyTotals[month] || 0);
  const firstDayStr = raw[raw.length - 1]?.dt ?? '';

  const allTimeOptions: Highcharts.Options = useMemo(() => {
    const fd = new Date(firstDayStr);
    return {
      chart: {
        type: 'column',
        zooming: {
          type: 'x',
        },
      },
      title: {
        text: t('charts.monthlyTotals'),
      },
      yAxis: {
        min: 0,
        title: {
          text: currency,
        },
      } as Highcharts.YAxisOptions,
      plotOptions: {
        column: {
          pointPadding: 0.2,
          borderWidth: 0,
          stacking: 'normal',
          groupPadding: 0,
        },
      },
      credits: {
        enabled: false,
      },
      tooltip: {
        shared: true,
      },
      series: [
        {
          name: category
            ? categories.find((c) => c.value === category)?.label
            : t('charts.monthlyTotals'),
          data: seriesData,
          colorByPoint: true,
          pointIntervalUnit: 'month',
          pointStart: Date.UTC(fd.getUTCFullYear(), fd.getMonth(), 1),
        },
        {
          name: t('common.income'),
          pointIntervalUnit: 'month',
          pointStart: Date.UTC(fd.getUTCFullYear(), fd.getMonth(), 1),
          type: 'spline',
          color: '#4DD0E1',
          visible: false,
          data: incomeTotals ? Object.values(incomeTotals).reverse() : [],
        },
      ] as Highcharts.SeriesOptionsType[],
      legend: { enabled: true },
      rangeSelector: { selected: 4 },
    };
  }, [
    t,
    currency,
    categories,
    category,
    incomeTotals,
    seriesData,
    firstDayStr,
  ]);

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={allTimeOptions}
    />
  );
};

export default React.memo(MonthlyTotals);
