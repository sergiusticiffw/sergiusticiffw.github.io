import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

export const LoanProgress = ({ data }) => {
  const { sumInstallments, totalPaidAmount } = data;

  const percentPaid = ((totalPaidAmount ?? 0) / sumInstallments) * 100;
  const percentRemaining = 100 - percentPaid;

  const options = {
    chart: {
      type: 'bar',
      backgroundColor: 'transparent',
      height: 20,
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
        dataLabels: {
          enabled: false,
        },
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
        dataLabels: {
          enabled: true,
          inside: true,
          align: 'right',
          style: {
            fontWeight: 'bold',
            color: 'white',
            textOutline: 'none',
          },
          formatter: function () {
            return `${Math.round(percentPaid)}%`;
          },
        },
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
