import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useAuthState, useData } from '@context/context';
import { AuthState, DataState } from '@type/types';
import { formatDataForChart } from '@utils/utils';
import { monthNames } from '@utils/constants';

const MonthlyComparisonIncomeTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  const formattedIncomeData = formatDataForChart(
    data?.totalIncomePerYearAndMonth || {}
  );

  const options = {
    chart: {
      type: 'column',
      zooming: {
        type: 'x',
      },
    },
    title: {
      text: 'Monthly Comparison Across Years',
    },
    xAxis: {
      categories: monthNames,
      crosshair: true,
    } as Highcharts.YAxisOptions,
    yAxis: {
      title: {
        text: currency,
      },
    },
    credits: {
      enabled: false,
    },
    tooltip: {
      shared: true,
    },
    series: formattedIncomeData,
    plotOptions: {
      column: {
        borderWidth: 0,
      },
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default MonthlyComparisonIncomeTrend;