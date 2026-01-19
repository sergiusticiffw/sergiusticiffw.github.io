import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { formatMonth, parseMonthString } from '@utils/utils';

const MonthlyTotals = () => {
  // All hooks must be called unconditionally at the top
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
  
  // Get categories - must be called unconditionally before any early returns
  const categories = getCategories();

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data, currency]);

  // Guard against empty data - must be after all hooks
  if (!data.raw || data.raw.length === 0) {
    return null;
  }

  const items = data.filtered || data;

  // Get the first and last day in the dataset
  const firstDay = new Date(data.raw[data.raw.length - 1]?.dt as string);
  const lastDay = new Date(data.raw[0]?.dt as string);

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

  // Prepare the data for the chart, ensuring every month is accounted for.
  const seriesData = allMonths.map((month) => monthlyTotals[month] || 0);

  const allTimeOptions: Highcharts.Options = {
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
        name: data.category
          ? categories.find((element) => element.value === data.category)
              ?.label
          : t('charts.monthlyTotals'),
        data: seriesData,
        colorByPoint: true,
        pointIntervalUnit: 'month',
        pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
      },
      {
        name: t('common.income'),
        pointIntervalUnit: 'month',
        pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
        type: 'spline',
        color: '#4DD0E1',
        visible: false,
        data: data.incomeTotals
          ? Object.values(data.incomeTotals)
              .reverse()
              .map((item) => {
                return item;
              })
          : [],
      },
    ] as Highcharts.SeriesOptionsType[],
    legend: {
      enabled: true,
    },
    rangeSelector: {
      selected: 4,
    },
  };

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={allTimeOptions}
    />
  );
};

export default MonthlyTotals;
