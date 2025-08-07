import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  calculateDaysFrom,
  formatDataForChart,
  formatNumber,
  getMonthsPassed,
} from '@utils/utils';
import { monthNames } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { getFinancialStabilityIcon } from '@utils/helper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, TrendingUp, Package } from 'lucide-react';

const YearAverageTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const items =
    data?.filtered?.totalsPerYearAndMonth || data?.totalsPerYearAndMonth;
  const totalPerYear = data?.filtered?.totalPerYear || data?.totalPerYear;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [
    data?.totalsPerYearAndMonth,
    data?.filtered?.totalsPerYearAndMonth,
    data?.totalPerYear,
    data?.filtered?.totalPerYear,
  ]);

  const totalSpent = data.filtered?.totalSpent || data?.totalSpent;
  const formattedData = formatDataForChart(items);

  const options: Highcharts.Options = {
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
      text: 'Years in review',
    },
    xAxis: {
      type: 'category',
      categories: monthNames,
      crosshair: true,
    },
    yAxis: {
      title: {
        text: currency,
      },
    },
    tooltip: {
      shared: true,
    },
    credits: {
      enabled: false,
    },
    // @ts-expect-error fix the tsc.
    series: formattedData,
  };
  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthlyAverage: number =
    totalSpent / getMonthsPassed(firstDay as string);
  const totalIncomePerYear = data?.totalIncomePerYear || {};
  let sumIncome: number = 0;
  const isFiltered = !!data.filtered_raw;
  const itms = Object.values(data.filtered_raw || data.raw).filter(
    (item) => item.type === 'transaction'
  );
  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={options} />

      {/* Total Spent Per Year */}
      <Card className="mt-6 border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Total Spent Per Year
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {Object.entries(totalPerYear).map((item, key) => {
            const savingsPercent =
              ((item[1] as number) / (totalIncomePerYear[item[0]] as number) -
                1) *
              -100;
            sumIncome += parseFloat(totalIncomePerYear[item[0]] as string);
            return (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                    {getFinancialStabilityIcon(savingsPercent, isFiltered)}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item[0]}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatNumber(item[1])} {currency}
                </span>
              </div>
            );
          })}

          {/* Total Spent */}
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Total Spent</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatNumber(totalSpent)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="mt-6 border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Total Days
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(calculateDaysFrom(firstDay))} days
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Total Months
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {getMonthsPassed(firstDay as string).toFixed(2)} months
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Total Items
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(itms.length + 1)} items
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Monthly Average
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(monthlyAverage)} {currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default YearAverageTrend;
