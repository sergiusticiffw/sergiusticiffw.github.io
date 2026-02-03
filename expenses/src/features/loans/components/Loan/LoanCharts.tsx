import React from 'react';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

export const LoanCostBreakdown = ({ data }) => {
  const currency = useSettingsCurrency();
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
      categories: [
        t('loan.principal'),
        t('loan.interests'),
        t('loan.installments'),
      ],
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
