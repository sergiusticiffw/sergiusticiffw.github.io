import React, { useEffect } from 'react';
import { useData } from '@context/context';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { TransactionOrIncomeItem, DataState } from '@type/types';

export default function MonthlyAverageTrend() {
  const { data } = useData() as DataState;
  const items = data.filtered_raw || data.raw;

  useEffect(() => {}, [data.raw, data.filtered_raw]);

  // Helper function to format month as "January 2024".
  const formatMonth = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const firstDay = new Date(data.raw[data.raw.length - 1]?.dt);
  let monthlyExpenses: { [s: string]: any; } | ArrayLike<any> = [];
  let totalExpensesAtDate = 0;
  let prevMonth = formatMonth(firstDay);
  let prevItemDate = firstDay;
  const dataInChronologicalOrder = items.slice().reverse();

  for (const item of dataInChronologicalOrder) {
    const itemDate = new Date(item.dt);
    const currentMonth = formatMonth(itemDate);
    if (currentMonth != prevMonth) {
      const daysPassed: number = (prevItemDate.getTime() - firstDay.getTime()) / 86400000 + 1;
      const monthsPassed: number = daysPassed / 30.42;
      monthlyExpenses[prevMonth] = [
        prevMonth,
        parseFloat(
            parseFloat(
                String(totalExpensesAtDate / monthsPassed)
            ).toFixed(2)
        ),
      ];
    }

    if ((item as TransactionOrIncomeItem).type === 'transaction') {
      totalExpensesAtDate += parseFloat(item.sum);
    }

    prevMonth = currentMonth;
    prevItemDate = itemDate;
  }

  monthlyExpenses = Object.values(monthlyExpenses);

  const series = [
    {
      name: 'Monthly average',
      data: monthlyExpenses,
      pointIntervalUnit: 'month',
      pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
    },
  ];

  const monthlyAverageOptions = {
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
      text: 'Monthly Average Trends',
    },
    colors: ['#E91E63', '#4DD0E1'],
    yAxis: {
      title: {
        text: 'Monthly average',
      },
    },
    xAxis: {
      type: 'category',
      crosshair: true,
    },
    tooltip: {
      xDateFormat: '%B %Y',
      shared: true,
      split: true,
    },
    credits: {
      enabled: false,
    },
    series: series,
  };

  return (
      <HighchartsReact
        highcharts={Highcharts}
        constructorType={'stockChart'}
        options={monthlyAverageOptions}
      />
  );
}
