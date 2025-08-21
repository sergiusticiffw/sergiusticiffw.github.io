import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { AuthState, DataState } from '@type/types';
import { formatDataForChart } from '@utils/utils';
import { getMonthNames } from '@utils/constants';

const MonthlyComparisonIncomeTrend = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();

  // Get localized month names
  const monthNames = getMonthNames();
  const formattedIncomeData = formatDataForChart(
    data?.totalIncomePerYearAndMonth || {},
    false,
    monthNames
  );

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
