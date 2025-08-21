import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { AuthState, DataState } from '@type/types';
import { formatDataForChart } from '@utils/utils';
import { getMonthNames } from '@utils/constants';

const MonthlyComparisonTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
  const items =
    data?.filtered?.totalsPerYearAndMonth || data?.totalsPerYearAndMonth;

  // Get localized month names
  const monthNames = getMonthNames();
  const formattedData = formatDataForChart(items, false, monthNames);

  const options = {
    chart: {
      type: 'column',
      zooming: {
        type: 'x',
      },
    },
    title: {
      text: t('charts.monthlyComparisonAcrossYears'),
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
