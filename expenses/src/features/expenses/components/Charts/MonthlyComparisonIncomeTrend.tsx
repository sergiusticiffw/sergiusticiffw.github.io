import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { expenseStore } from '@stores/expenseStore';
import { useStore } from '@tanstack/react-store';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import { formatDataForChart } from '@shared/utils/utils';
import { getMonthNames } from '@shared/utils/constants';

const MonthlyComparisonIncomeTrend = () => {
  const totalIncomePerYearAndMonth = useStore(
    expenseStore,
    (s) => s.totalIncomePerYearAndMonth
  );
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const monthNames = getMonthNames();
  const formattedIncomeData = useMemo(
    () =>
      formatDataForChart(totalIncomePerYearAndMonth ?? {}, false, monthNames),
    [totalIncomePerYearAndMonth, monthNames]
  );
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { type: 'column', zooming: { type: 'x' } },
      title: { text: t('charts.monthlyComparisonAcrossYears') },
      xAxis: { categories: monthNames, crosshair: true },
      yAxis: { title: { text: currency } },
      credits: { enabled: false },
      tooltip: { shared: true },
      series: formattedIncomeData,
      plotOptions: { column: { borderWidth: 0 } },
    }),
    [t, monthNames, currency, formattedIncomeData]
  );
  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default React.memo(MonthlyComparisonIncomeTrend);
