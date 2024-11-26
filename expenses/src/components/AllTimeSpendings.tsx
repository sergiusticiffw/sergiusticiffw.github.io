import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { AuthState, DataState } from '@type/types';

const AllTimeSpendings = () => {
  // All time section
  const {
    data: { categoryTotals = {} },
    data,
  } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data, currency]);

  const items = categoryTotals ? Object.values(categoryTotals) : [];
  const allTimeSpendings: Highcharts.Options = {
    chart: {
      type: 'pie',
    },
    title: {
      text: "All Time Spending's",
      verticalAlign: 'middle'
    },
    tooltip: {
      pointFormat: '{point.y} {series.name} ({point.percentage:.2f})%',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        innerSize: '70%',
        dataLabels: {
          enabled: false
        }
      },
    },
    series: [
      {
        name: currency,
        type: 'pie',
        data: items,
      },
    ],
    credits: {
      enabled: false,
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={allTimeSpendings} />;
};

export default AllTimeSpendings;
