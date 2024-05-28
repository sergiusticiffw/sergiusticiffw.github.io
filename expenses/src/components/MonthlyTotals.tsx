import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { categories } from '@utils/constants';
import { AuthState, DataState } from '@type/types';

const MonthlyTotals = () => {
  const { data } = useData() as DataState;
  const items = data;
  const { currency } = useAuthState() as AuthState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data, currency]);

  const firstDay = new Date(data.raw[data.raw.length - 1]?.dt as string);

  const allTimeOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      zooming: {
        type: 'x',
      },
    },
    title: {
      text: 'Monthly Totals',
    },
    yAxis: {
      min: 0,
      title: {
        text: currency,
      },
    } as Highcharts.YAxisOptions,
    plotOptions: {
      column: {
        pointPadding: 0.2,
        borderWidth: 0,
        stacking: 'normal',
        groupPadding: 0,
      },
    },
    credits: {
      enabled: false,
    },
    tooltip: {
      shared: true,
    },
    series: [
      {
        name: data.category
          ? categories.find((element) => element.value === data.category)?.label
          : 'Monthly totals',
        data: items.totals ? Object.values(items.totals).reverse() : [],
        colorByPoint: true,
        pointIntervalUnit: 'month',
        pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
      },
      {
        name: 'Income',
        pointIntervalUnit: 'month',
        pointStart: Date.UTC(firstDay.getUTCFullYear(), firstDay.getMonth(), 1),
        type: 'spline',
        color: '#4DD0E1',
        visible: false,
        data: items.incomeTotals
          ? Object.values(items.incomeTotals)
              .reverse()
              .map((item) => {
                return item;
              })
          : [],
      },
    ] as Highcharts.SeriesOptionsType[],
    legend: {
      enabled: true,
    },
    rangeSelector: {
      selected: 4,
    },
  };

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={allTimeOptions}
    />
  );
};

export default MonthlyTotals;
