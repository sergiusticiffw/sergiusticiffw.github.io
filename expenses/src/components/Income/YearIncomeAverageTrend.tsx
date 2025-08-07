import React from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { formatDataForChart, formatNumber } from '@utils/utils';
import { monthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

const YearIncomeAverageTrend: React.FC = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  const totalIncomePerYear = data?.totalIncomePerYear || {};
  const totalPerYear = data?.totalPerYear || {};
  const totalSpent = data?.totalSpent || 0;

  const formattedIncomeData = formatDataForChart(
    data?.totalIncomePerYearAndMonth || {}
  );

  const yearIncomeAverageOptions: Highcharts.Options = {
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      height: 500,
      zooming: {
        type: 'x',
      },
    },
    boost: {
      useGPUTranslations: true,
    },
    title: {
      text: 'Years in Review',
      style: {
        color: '#F9FAFB',
        fontSize: '18px',
        fontWeight: '600',
      },
    },
    xAxis: {
      type: 'category',
      categories: monthNames,
      crosshair: {
        color: '#6B7280',
        width: 1,
      },
      labels: {
        style: {
          color: '#F9FAFB',
        },
      },
      gridLineColor: '#374151',
    },
    yAxis: {
      title: {
        text: currency,
        style: {
          color: '#F9FAFB',
          fontSize: '14px',
        },
      },
      labels: {
        style: {
          color: '#F9FAFB',
        },
      },
      gridLineColor: '#374151',
    },
    tooltip: {
      shared: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#374151',
      borderRadius: 8,
      style: {
        color: '#F9FAFB',
      },
    },
    credits: {
      enabled: false,
    },
    series: formattedIncomeData as any,
  };

  let sumDiff: number = 0;
  let sumIncome: number = 0;
  return (
    <>
      <HighchartsReact
        highcharts={Highcharts}
        options={yearIncomeAverageOptions}
      />
      
      {/* Total Income Per Year */}
      <Card className="mt-6 border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Total Income Per Year
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Table Header */}
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border/50 mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Year</span>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-sm font-semibold text-muted-foreground">Income</span>
              <span className="text-sm font-semibold text-muted-foreground">Spent</span>
              <span className="text-sm font-semibold text-muted-foreground">Savings</span>
            </div>
          </div>
          
          {Object.entries(totalIncomePerYear).map((item, key) => {
            const income = item[1] as number;
            const spent = (totalPerYear[item[0]] as number) || 0;
            const diff: number = income - spent;
            const savingsPercent = (spent / income - 1) * -100;
            sumDiff += diff;
            sumIncome += income;
            return (
              <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    {getFinancialStabilityIcon(savingsPercent)}
                  </div>
                  <span className="text-sm text-muted-foreground">{item[0]}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium text-foreground">
                    {formatNumber(income)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatNumber(spent)}
                  </span>
                  <span className="font-medium text-foreground">
                    {isFinite(savingsPercent)
                      ? `${formatNumber(diff)} (${formatNumber(savingsPercent)}%)`
                      : `${formatNumber(diff)}`}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Total Row */}
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-foreground">
                {formatNumber(sumIncome)}
              </span>
              <span className="text-muted-foreground">
                {formatNumber(totalSpent)}
              </span>
              <span className="font-medium text-foreground">
                {formatNumber(sumDiff)} (
                {formatNumber((totalSpent / sumIncome - 1) * -100)}
                %)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default YearIncomeAverageTrend;
