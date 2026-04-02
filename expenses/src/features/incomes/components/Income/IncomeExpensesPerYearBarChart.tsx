import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import type { TransactionOrIncomeItem } from '@shared/type/types';
import { formatNumber } from '@shared/utils/utils';

type DateRange = { start: string; end: string } | null;

interface IncomeExpensesPerYearBarChartProps {
  filteredIncomeData: TransactionOrIncomeItem[];
  dateRange: DateRange;
}

function isDateInRange(dateIso: string, dateRange: { start: string; end: string }) {
  // Compare via YYYY-MM-DD strings to match the filter format.
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const key = `${y}-${m}-${day}`;
  return key >= dateRange.start && key <= dateRange.end;
}

export default function IncomeExpensesPerYearBarChart({
  filteredIncomeData,
  dateRange,
}: IncomeExpensesPerYearBarChartProps) {
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
  const { t } = useLocalization();

  const { years, incomeTotals, expenseTotals } = useMemo(() => {
    const expenseTotalsAcc: Record<string, number> = {};
    const incomeTotalsAcc: Record<string, number> = {};

    const raw = data.raw || [];
    for (const item of raw) {
      if (!item || item.type !== 'transaction') continue;
      const dt = item.dt;
      if (!dt) continue;
      if (dateRange?.start && dateRange?.end && !isDateInRange(dt, dateRange)) continue;
      const year = new Date(dt).getFullYear();
      if (!expenseTotalsAcc[String(year)]) expenseTotalsAcc[String(year)] = 0;
      expenseTotalsAcc[String(year)] += parseFloat(item.sum || '0');
    }

    for (const item of filteredIncomeData) {
      const dt = item.dt;
      if (!dt) continue;
      // filteredIncomeData already includes dateRange filter, but keep it safe.
      if (dateRange?.start && dateRange?.end && !isDateInRange(dt, dateRange)) continue;
      const year = new Date(dt).getFullYear();
      if (!incomeTotalsAcc[String(year)]) incomeTotalsAcc[String(year)] = 0;
      incomeTotalsAcc[String(year)] += parseFloat(item.sum || '0');
    }

    const yearsSet = new Set<string>([
      ...Object.keys(expenseTotalsAcc),
      ...Object.keys(incomeTotalsAcc),
    ]);

    const yearsSorted = Array.from(yearsSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    return {
      years: yearsSorted,
      incomeTotals: incomeTotalsAcc,
      expenseTotals: expenseTotalsAcc,
    };
  }, [data.raw, filteredIncomeData, dateRange]);

  const series = useMemo(() => {
    const expenses = years.map((y) => expenseTotals[y] || 0);
    const income = years.map((y) => incomeTotals[y] || 0);
    return { expenses, income };
  }, [years, expenseTotals, incomeTotals]);

  if (years.length === 0) return null;

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: {
        type: 'bar',
        height: 420,
      },
      title: {
        text: t('income.totalIncomePerYear') + ' vs ' + t('income.spent'),
      },
      credits: { enabled: false },
      xAxis: {
        categories: years,
        crosshair: true,
        title: { text: t('income.year') },
      },
      yAxis: {
        min: 0,
        title: { text: '' },
        labels: { enabled: false },
      },
      legend: { enabled: true },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function () {
          const pts = (this.points ?? []) as Array<any>;
          const yearLabel =
            pts[0]?.key ?? pts[0]?.category ?? pts[0]?.x ?? this.x;
          const rows = pts
            .map((p) => {
              const y = p?.y ?? 0;
              return `
                <div style="margin:2px 0">
                  <span style="color:${p.color}">●</span>
                  <span style="opacity:.9">${p.series.name}:</span>
                  <b style="margin-left:6px">${formatNumber(y)} ${currency}</b>
                </div>
              `;
            })
            .join('');

          return `
            <div style="min-width:170px">
              <div style="margin-bottom:6px"><b>${yearLabel}</b></div>
              ${rows}
            </div>
          `;
        },
      },
      plotOptions: {
        series: {
          borderWidth: 0,
          grouping: true,
        },
      },
      series: [
        {
          type: 'bar',
          name: t('income.spent'),
          data: series.expenses,
        },
        {
          type: 'bar',
          name: t('common.income'),
          data: series.income,
        },
      ] as Highcharts.SeriesOptionsType[],
    }),
    [t, years, currency, series.expenses, series.income]
  );

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

