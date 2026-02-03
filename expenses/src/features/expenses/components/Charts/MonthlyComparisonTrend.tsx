import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useExpenseChartView } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import { formatDataForChart } from '@shared/utils/utils';
import { getMonthNames } from '@shared/utils/constants';

const MonthlyComparisonTrend = () => {
  const view = useExpenseChartView();
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const monthNames = getMonthNames();
  const items = view?.totalsPerYearAndMonth ?? null;
  const formattedData = useMemo(
    () => formatDataForChart(items, false, monthNames),
    [items, monthNames]
  );
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', zooming: { type: 'x' } },
      title: { text: t('charts.monthlyComparisonAcrossYears') },
      xAxis: { categories: monthNames, crosshair: true },
      yAxis: { title: { text: currency } },
      credits: { enabled: false },
      tooltip: { shared: true },
      series: formattedData,
      plotOptions: { column: { borderWidth: 0 } },
    }),
    [t, monthNames, currency, formattedData]
  );
  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default React.memo(MonthlyComparisonTrend);
