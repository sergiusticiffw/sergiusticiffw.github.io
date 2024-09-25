import React, { useEffect } from 'react';
import { useData } from '@context/context';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { DataState } from '@type/types';
import { formatMonth } from '@utils/utils';

const MonthlyAverageTrend = () => {
  const { data } = useData() as DataState;
  useEffect(() => {}, [data.raw, data.filtered_raw]);

  const totals = data?.filtered?.totals || data?.totals;

  const firstDay = new Date(data.raw[data.raw.length - 1]?.dt as string);
  const fillMonths = (
    startDate: string | number | Date,
    endDate: number | Date
  ) => {
    const filledMonths = [];
    let currentDate = new Date(startDate);
    let total = 0;
    while (currentDate <= endDate) {
      const monthStr = formatMonth(currentDate);
      const lastDayOfMonth = new Date(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() + 1,
        0
      );
      const daysPassed: number =
        (lastDayOfMonth.getTime() - firstDay.getTime()) / 86400000 + 1;
      const monthsPassed: number = daysPassed / 30.42;
      total = total + (totals[monthStr] || 0);
      filledMonths.push([
        monthStr,
        parseFloat(parseFloat(String(total / monthsPassed)).toFixed(2)),
      ]);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return filledMonths;
  };

  const now = new Date();
  const lastDayOfCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );
  const monthsData = fillMonths(firstDay, lastDayOfCurrentMonth);

  const series = [
    {
      name: 'Monthly average',
      data: monthsData.slice(0, -1),
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
    colors: ['#E91E63'],
    yAxis: {
      min: 0,
      title: {
        text: 'Monthly average',
      },
    },
    xAxis: {
      type: 'datetime',
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
};

export default MonthlyAverageTrend;
