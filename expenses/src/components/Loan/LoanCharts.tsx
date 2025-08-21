import React from 'react';
import { useAuthState } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { AuthState } from '@type/types';

export const LoanCostBreakdown = ({ data }) => {
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
  const { principal, sumOfInterest, sumInstallments } = data;

  const options = {
    chart: {
      type: 'column',
    },
    title: {
      text: t('loan.loanCostBreakdown'),
    },
    xAxis: {
      categories: [t('loan.principal'), t('loan.interests'), t('loan.installments')],
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
        name: t('common.total'),
        colorByPoint: true,
        data: [principal, sumOfInterest, sumInstallments],
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
