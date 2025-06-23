import React from 'react';
import { useAuthState } from '@context/context';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { AuthState } from '@type/types';

export const LoanCostBreakdown = ({ data }) => {
  const { currency } = useAuthState() as AuthState;
  const { principal, sumOfInterest, sumInstallments } = data;

  const options = {
    chart: {
      type: 'column',
    },
    title: {
      text: 'Loan Cost Breakdown',
    },
    xAxis: {
      categories: ['Principal', 'Interests', 'Installments'],
    },
    yAxis: {
      min: 0,
      title: {
        text: currency,
      },
    },
    tooltip: {
      valueDecimals: 2,
    },
    series: [
      {
        name: 'Total',
        colorByPoint: true,
        data: [principal, sumOfInterest, sumInstallments],
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
