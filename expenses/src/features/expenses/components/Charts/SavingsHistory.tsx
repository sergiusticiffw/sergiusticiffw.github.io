import React, { useEffect, useState, useMemo } from 'react';
import { expenseStore } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { TransactionOrIncomeItem } from '@shared/type/types';

interface SavingsData {
  [key: string]: [number, number];
}

const SavingsHistory = () => {
  const raw = useStore(expenseStore, (s) => s.raw);
  const { t } = useLocalization();
  const [items, setItems] = useState<TransactionOrIncomeItem[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => setItems(raw ?? []), 200);
    return () => clearTimeout(timeout);
  }, [raw]);

  const savings: SavingsData = {};
  let totalExpensesAtDate = 0;
  let totalIncomesAtDate = 0;
  const dataInChronologicalOrder = items.slice().reverse();

  for (const item of dataInChronologicalOrder) {
    const itemDate = new Date((item as TransactionOrIncomeItem).dt);
    if ((item as TransactionOrIncomeItem).type === 'incomes') {
      totalIncomesAtDate =
        totalIncomesAtDate + parseFloat((item as TransactionOrIncomeItem).sum);
    } else {
      totalExpensesAtDate =
        totalExpensesAtDate + parseFloat((item as TransactionOrIncomeItem).sum);
    }

    const num = Number(
      ((totalExpensesAtDate / totalIncomesAtDate - 1) * -100).toFixed(2)
    );
    savings[(item as TransactionOrIncomeItem).dt] = [itemDate.getTime(), num];
  }

  const savingsArray = Object.values(savings);

  if (savingsArray.length > 14) {
    savingsArray.splice(0, 14);
  }

  const series: Highcharts.SeriesOptionsType[] = [
    {
      name: t('charts.savings'),
      data: savingsArray,
      negativeColor: '#E91E63',
      type: 'line',
      tooltip: {
        valueDecimals: 2,
      },
    },
  ];

  const savingsOptions: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'line', zooming: { type: 'x' } },
      boost: { useGPUTranslations: true },
      title: { text: t('charts.savingsHistory') },
      colors: ['#4DD0E1'],
      yAxis: { title: { text: '%' } },
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
      options={savingsOptions}
    />
  );
};

export default React.memo(SavingsHistory);
