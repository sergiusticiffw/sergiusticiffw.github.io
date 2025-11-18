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
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'Inter, "SF Pro Display", system-ui',
      },
    },
    title: {
      text: t('loan.loanCostBreakdown'),
      style: {
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '600',
      },
    },
    xAxis: {
      categories: [
        t('loan.principal'),
        t('loan.interests'),
        t('loan.installments'),
      ],
      labels: {
        style: {
          color: 'rgba(255,255,255,0.7)',
        },
      },
      lineColor: 'rgba(255,255,255,0.1)',
      tickColor: 'rgba(255,255,255,0.1)',
    },
    yAxis: {
      min: 0,
      gridLineColor: 'rgba(255,255,255,0.08)',
      title: {
        text: currency,
        style: {
          color: 'rgba(255,255,255,0.7)',
        },
      },
      labels: {
        style: {
          color: 'rgba(255,255,255,0.7)',
        },
      },
    },
    legend: {
      enabled: false,
    },
    tooltip: {
      valueDecimals: 2,
      backgroundColor: 'rgba(15,15,25,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      style: {
        color: '#fff',
      },
    },
    plotOptions: {
      column: {
        borderRadius: 8,
        pointPadding: 0.2,
        borderWidth: 0,
      },
    },
    colors: ['#6c8bff', '#6fe0c4', '#ffb567'],
    series: [
      {
        name: t('common.total'),
        colorByPoint: true,
        data: [principal, sumOfInterest, sumInstallments],
      },
    ],
    credits: {
      enabled: false,
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
