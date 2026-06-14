import React, { useEffect, useState, useMemo } from 'react';
import { expenseStore } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { TransactionOrIncomeItem, Daily } from '@shared/type/types';

const DailyAverageTrend = () => {
  const raw = useStore(expenseStore, (s) => s.raw);
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const { t } = useLocalization();

  const [items, setItems] = useState<TransactionOrIncomeItem[]>([]);
  const isFiltered = !!filteredRaw;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setItems(filteredRaw || raw || []);
    }, 200);
    return () => clearTimeout(timeout);
  }, [raw, filteredRaw]);

  const firstDay = new Date(raw?.[raw.length - 1]?.dt ?? '');
  const getNrOfDaysFromStart = (endDate: Date) => {
    const difference = endDate.getTime() - firstDay.getTime();
    return parseInt(String(difference / (1000 * 3600 * 24))) + 1;
  };

  let dailyExpenses: Daily[] = [];
  let dailyIncomes: Daily[] = [];
  let totalExpensesAtDate = 0;
  let totalIncomesAtDate = 0;
  const dataInChronologicalOrder = items.slice().reverse();

  for (const item of dataInChronologicalOrder) {
    const itemDate = new Date((item as TransactionOrIncomeItem).dt);
    if ((item as TransactionOrIncomeItem).type === 'incomes') {
      totalIncomesAtDate =
        parseFloat(String(totalIncomesAtDate)) +
        parseFloat((item as TransactionOrIncomeItem).sum);
    } else {
      totalExpensesAtDate =
        parseFloat(String(totalExpensesAtDate)) +
        parseFloat((item as TransactionOrIncomeItem).sum);
    }

    dailyIncomes[(item as TransactionOrIncomeItem).dt] = [
      itemDate.getTime(),
      parseFloat(
        parseFloat(
          String(totalIncomesAtDate / getNrOfDaysFromStart(itemDate))
        ).toFixed(2)
      ),
    ];
    dailyExpenses[(item as TransactionOrIncomeItem).dt] = [
      itemDate.getTime(),
      parseFloat(
        parseFloat(
          String(totalExpensesAtDate / getNrOfDaysFromStart(itemDate))
        ).toFixed(2)
      ),
    ];
  }

  dailyExpenses = Object.values(dailyExpenses);
  dailyIncomes = Object.values(dailyIncomes);
  if (dailyExpenses.length > 14 && !isFiltered) {
    dailyExpenses.splice(0, 14);
    dailyIncomes.splice(0, 14);
  }

  const series: Highcharts.SeriesOptionsType[] = [
    {
      name: t('charts.dailyExpenses'),
      data: dailyExpenses,
      color: '#E91E63',
      type: 'line',
      tooltip: {
        valueDecimals: 2,
      },
    },
  ];
  if (!isFiltered) {
    series.push({
      name: t('charts.dailyIncomes'),
      data: dailyIncomes,
      color: '#4DD0E1',
      type: 'line',
      tooltip: {
        valueDecimals: 2,
      },
    });
  }

  const dailyAverageOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'line', zooming: { type: 'x' } },
      boost: { useGPUTranslations: true },
      title: { text: t('charts.dailyAverageTrends') },
      yAxis: { title: { text: t('charts.dailyAverage') } },
      xAxis: { type: 'datetime', crosshair: true },
      credits: { enabled: false },
      series,
      legend: { enabled: true },
    }),
    [t, series]
  );

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={dailyAverageOptions}
    />
  );
};

export default React.memo(DailyAverageTrend);
