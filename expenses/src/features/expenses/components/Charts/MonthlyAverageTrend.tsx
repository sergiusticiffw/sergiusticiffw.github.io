import React, { useMemo } from 'react';
import { useExpenseChartView } from '@stores/expenseStore';
import { expenseStore } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { calculateDaysFrom, formatMonth } from '@shared/utils/utils';

const MonthlyAverageTrend = () => {
  const view = useExpenseChartView();
  const raw = useStore(expenseStore, (s) => s.raw);
  const { t } = useLocalization();
  const totals = view?.totals ?? {};

  const firstDay = new Date(raw?.[raw.length - 1]?.dt ?? '');
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
      const daysPassed: number = calculateDaysFrom(firstDay, lastDayOfMonth);
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
      name: t('charts.monthlyAverage'),
      data: monthsData.slice(0, -1),
      pointIntervalUnit: 'month',
      pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
    },
  ];

  const monthlyAverageOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'line', zooming: { type: 'x' } },
      boost: { useGPUTranslations: true },
      title: { text: t('charts.monthlyAverageTrends') },
      colors: ['#E91E63'],
      yAxis: { min: 0, title: { text: t('charts.monthlyAverage') } },
      xAxis: { type: 'datetime', crosshair: true },
      credits: { enabled: false },
      series,
    }),
    [t, series]
  );

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={monthlyAverageOptions}
    />
  );
};

export default React.memo(MonthlyAverageTrend);
