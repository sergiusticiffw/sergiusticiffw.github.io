import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

export const LoanProgress = ({ data }) => {
  const { sumInstallments, amortizationSchedule } = data;

  const wasPayed = amortizationSchedule
    .filter(row => row[7] === true)
    .map(row => parseFloat(row[3]))
    .filter(n => !isNaN(n))
    .reduce((sum, val) => sum + val, 0);

  const percentPaid = (wasPayed / sumInstallments) * 100;
  const percentRemaining = 100 - percentPaid;

  const options = {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: 16,
      margin: [0, 0, 0, 0],
    },
    title: null,
    xAxis: {
      visible: false,
    },
    yAxis: {
      visible: false,
      min: 0,
      max: 100,
    },
    tooltip: {
      enabled: false,
    },
    plotOptions: {
      series: {
        stacking: 'normal',
        borderWidth: 0,
        groupPadding: 0,
        pointPadding: 0,
      },
      bar: {
        borderRadius: 3,
      },
    },
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        name: 'Remaining',
        data: [percentRemaining],
        color: '#888',
      },
      {
        name: 'Paid',
        data: [percentPaid],
        color: '#4caf50',
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
