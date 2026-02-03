import React, { useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { TransactionOrIncomeItem } from '@shared/type/types';
import { monthNames, incomeSuggestions } from '@shared/utils/constants';
import { hasTag, formatNumber, parseMonthString } from '@shared/utils/utils';

function IncomeIntelligence() {
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
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

    // Initialize totals for pie chart (using tags as keys for consistency)
    const sourceTotals: Record<string, number> = {};
    incomeSuggestions.forEach((tag) => {
      sourceTotals[tag] = 0;
    });
    let untaggedTotal = 0;

    // Initialize monthly data for line chart (using tags as keys)
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
          monthlyData[month][tag] = 0;
        });
        monthlyData[month]['untagged'] = 0;
      }

      // Check for tags and categorize
      let categorized = false;
      for (const tag of incomeSuggestions) {
        if (hasTag(item, tag)) {
          sourceTotals[tag] = sourceTotals[tag] + amount;
          monthlyData[month][tag] = monthlyData[month][tag] + amount;
          categorized = true;
          break; // Only use first matching tag
        }
      }

      if (!categorized) {
        untaggedTotal += amount;
        monthlyData[month]['untagged'] =
          (monthlyData[month]['untagged'] || 0) + amount;
      }
    });

    // Prepare pie chart data (translate labels for display)
    const pieData = Object.entries(sourceTotals)
      .map(([tag, y]) => ({
        name: t(`income.tags.${tag}`) || tag,
        y,
      }))
      .filter((item) => item.y > 0);

    if (untaggedTotal > 0) {
      pieData.push({
        name: t('income.tags.untagged'),
        y: untaggedTotal,
      });
    }

    // Sort months chronologically using parseMonthString utility
    const sortedMonths = Array.from(allMonths).sort((a, b) => {
      const dateA = parseMonthString(a);
      const dateB = parseMonthString(b);
      if (
        !dateA ||
        !dateB ||
        isNaN(dateA.getTime()) ||
        isNaN(dateB.getTime())
      ) {
        return 0;
      }
      return dateA.getTime() - dateB.getTime();
    });

    // Prepare line chart series with timestamps for Highcharts Stock (translate labels for display)
    const lineSeries = incomeSuggestions
      .map((tag) => {
        const label = t(`income.tags.${tag}`) || tag;
        const data = sortedMonths.map((month) => {
          // Parse month string to get timestamp using parseMonthString utility
          const monthDate = parseMonthString(month);
          if (monthDate && !isNaN(monthDate.getTime())) {
            // Use UTC timestamp to avoid timezone issues
            const timestamp = Date.UTC(
              monthDate.getFullYear(),
              monthDate.getMonth(),
              1
            );
            return [timestamp, monthlyData[month]?.[tag] || 0];
          }
          return [0, 0];
        });
        return {
          name: label,
          data,
          type: 'line',
          visible: tag === 'salary', // Only salary is visible by default
        };
      })
      .concat([
        {
          name: t('income.tags.untagged'),
          data: sortedMonths.map((month) => {
            const monthDate = parseMonthString(month);
            if (monthDate && !isNaN(monthDate.getTime())) {
              // Use UTC timestamp to avoid timezone issues
              const timestamp = Date.UTC(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                1
              );
              return [timestamp, monthlyData[month]?.['untagged'] || 0];
            }
            return [0, 0];
          }),
          type: 'line',
          visible: false, // Untagged is hidden by default
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
  }, [incomeData, language, t]);

  const pieOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
    },
    boost: {
      useGPUTranslations: true,
    },
    title: {
      text: t('income.incomeBySource') || 'Income by Source',
      verticalAlign: 'middle',
    },
    tooltip: {
      pointFormat: '{point.y} {series.name} ({point.percentage:.2f}%)',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        innerSize: '70%',
        borderWidth: 2,
        borderColor: '#1a1a1a',
        dataLabels: {
          enabled: false,
        },
        states: {
          hover: {
            brightness: 0.1,
            halo: {
              size: 10,
            },
          },
          select: {
            brightness: 0.1,
          },
        },
        slicedOffset: 10,
      },
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        type: 'pie',
        name: currency,
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
      selected: 1, // Default to "1 Year" (Highcharts handles user changes)
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
    legend: {
      enabled: true,
    },
    series: chartData.lineSeries as any,
  };

  if (chartData.pieData.length === 0) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white m-0 mb-2">{t('income.incomeIntelligence') || 'Income Intelligence'}</h3>
        <p className="text-white/70 m-0">
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

// Prevent rerenders from parent polling/state churn (keeps Highcharts range stable)
export default React.memo(IncomeIntelligence);
