import React, { useMemo } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { AuthState, DataState, TransactionOrIncomeItem } from '@type/types';
import { monthNames, incomeSuggestions } from '@utils/constants';
import { hasTag, formatNumber, parseMonthString } from '@utils/utils';

// Map income suggestions to user-friendly labels
const incomeSourceLabels: Record<string, string> = {
  salary: 'Salary',
  bonus: 'Bonuses',
  freelance: 'Freelance',
  overtime: 'Overtime',
  interest: 'Interest',
  gift: 'Gifts',
  cashback: 'Cashback',
  sale: 'Sales',
  loan: 'Loans',
};

export default function IncomeIntelligence() {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t, language } = useLocalization();

  // Use income data - component will work with filtered or unfiltered data
  // Filtering happens at parent level (Income page)
  const incomeData = data.incomeData || [];

  const chartData = useMemo(() => {
    if (!incomeData || incomeData.length === 0) {
      return {
        pieData: [],
        lineData: {},
        months: [],
        lineSeries: [],
      };
    }

    // Initialize totals for pie chart
    const sourceTotals: Record<string, number> = {};
    incomeSuggestions.forEach((tag) => {
      const label = incomeSourceLabels[tag] || tag;
      sourceTotals[label] = 0;
    });
    let untaggedTotal = 0;

    // Initialize monthly data for line chart
    const monthlyData: Record<string, Record<string, number>> = {};
    const allMonths = new Set<string>();

    // Process each income item
    incomeData.forEach((item: TransactionOrIncomeItem) => {
      const amount = parseFloat(item.sum || '0');
      const date = new Date(item.dt);
      const month = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      allMonths.add(month);

      if (!monthlyData[month]) {
        monthlyData[month] = {};
        incomeSuggestions.forEach((tag) => {
          const label = incomeSourceLabels[tag] || tag;
          monthlyData[month][label] = 0;
        });
        monthlyData[month]['Untagged'] = 0;
      }

      // Check for tags and categorize
      let categorized = false;
      for (const tag of incomeSuggestions) {
        if (hasTag(item, tag)) {
          const label = incomeSourceLabels[tag] || tag;
          sourceTotals[label] = (sourceTotals[label] || 0) + amount;
          monthlyData[month][label] =
            (monthlyData[month][label] || 0) + amount;
          categorized = true;
          break; // Only use first matching tag
        }
      }

      if (!categorized) {
        untaggedTotal += amount;
        monthlyData[month]['Untagged'] =
          (monthlyData[month]['Untagged'] || 0) + amount;
      }
    });

    // Prepare pie chart data
    const pieData = Object.entries(sourceTotals)
      .map(([name, y]) => ({
        name,
        y,
      }))
      .filter((item) => item.y > 0);

    if (untaggedTotal > 0) {
      pieData.push({
        name: 'Untagged',
        y: untaggedTotal,
      });
    }

    // Sort months chronologically using parseMonthString utility
    const sortedMonths = Array.from(allMonths).sort((a, b) => {
      const dateA = parseMonthString(a, language);
      const dateB = parseMonthString(b, language);
      if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
        return 0;
      }
      return dateA.getTime() - dateB.getTime();
    });

    // Prepare line chart series with timestamps for Highcharts Stock
    const lineSeries = Object.keys(incomeSourceLabels)
      .map((tag) => {
        const label = incomeSourceLabels[tag];
        const data = sortedMonths.map((month) => {
          // Parse month string to get timestamp using parseMonthString utility
          const monthDate = parseMonthString(month, language);
          if (monthDate && !isNaN(monthDate.getTime())) {
            return [monthDate.getTime(), monthlyData[month]?.[label] || 0];
          }
          return [0, 0];
        });
        return {
          name: label,
          data,
          type: 'line',
        };
      })
      .concat([
        {
          name: 'Untagged',
          data: sortedMonths.map((month) => {
            const monthDate = parseMonthString(month, language);
            if (monthDate && !isNaN(monthDate.getTime())) {
              return [monthDate.getTime(), monthlyData[month]?.['Untagged'] || 0];
            }
            return [0, 0];
          }),
          type: 'line',
        },
      ])
      .filter((series) => {
        // Only include series with at least one non-zero value
        return series.data.some((value: any) => value[1] > 0);
      });

      return {
        pieData,
        lineData: monthlyData,
        months: sortedMonths,
        lineSeries,
      };
  }, [incomeData, language]);

  const pieOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
    },
    boost: {
      useGPUTranslations: true,
    },
    title: {
      text: t('income.incomeBySource') || 'Income by Source',
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b><br/>Amount: <b>{point.y}</b> {currency}',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %',
        },
      },
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        type: 'pie',
        name: 'Income Source',
        data: chartData.pieData,
      },
    ],
  };

  const lineOptions: Highcharts.Options = {
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
      text: t('income.incomeEvolutionBySource') || 'Income Evolution by Source',
    },
    xAxis: {
      type: 'datetime',
      crosshair: true,
    },
    yAxis: {
      title: {
        text: 'Amount',
      },
      min: 0,
    },
    tooltip: {
      shared: true,
      split: false,
      xDateFormat: '%B %Y',
    },
    plotOptions: {
      line: {
        marker: {
          enabled: true,
        },
      },
    },
    credits: {
      enabled: false,
    },
    rangeSelector: {
      selected: 1, // Default to "1 Year"
      buttons: [
        {
          type: 'all',
          text: 'View All',
        },
        {
          type: 'year',
          count: 1,
          text: '1 Year',
        },
        {
          type: 'year',
          count: 2,
          text: '2 Years',
        },
        {
          type: 'year',
          count: 5,
          text: '5 Years',
        },
      ],
      allButtonsEnabled: true,
    },
    series: chartData.lineSeries as any,
  };

  if (chartData.pieData.length === 0) {
    return (
      <div>
        <h3>{t('income.incomeIntelligence') || 'Income Intelligence'}</h3>
        <p>
          {t('income.noIncomeDataAvailable') ||
            'No income data available. Add income entries with tags like #salary, #freelance, #bonus, #interest, or #gift.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <HighchartsReact highcharts={Highcharts} options={pieOptions} />
      </div>
      <div>
        <HighchartsReact
          highcharts={Highcharts}
          constructorType={'stockChart'}
          options={lineOptions}
        />
      </div>
    </div>
  );
}
