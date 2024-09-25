import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useAuthState, useData } from '@context/context';
import { AuthState, DataState } from '@type/types';
import { formatDataForChart } from '@utils/utils';
import { monthNames } from '@utils/constants';

const MonthlyComparisonTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const items =
    data?.filtered?.totalsPerYearAndMonth || data?.totalsPerYearAndMonth;

  const formattedData = formatDataForChart(items);

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
    series: formattedData,
    plotOptions: {
      column: {
        borderWidth: 0,
      },
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default MonthlyComparisonTrend;
