import React from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@shared/utils/constants';
import { TransactionOrIncomeItem } from '@shared/type/types';

interface MonthProps {
  month: string;
}

const Month: React.FC<MonthProps> = ({ month }) => {
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
  useLocalization();
  const items: TransactionOrIncomeItem[] | undefined =
    data?.groupedData?.[month];
  if (!items) return null;

  const totals = {};

  // Get localized categories
  const localizedCategories = getCategories();

  for (const item of items) {
    if (item.type === 'incomes') {
      continue;
    }
    const category = localizedCategories.find(
      (element) => element.value === item.cat
    )?.label;
    if (!totals[category]) {
      totals[category] = { name: category, y: 0 };
    }
    totals[category].y = parseFloat(
      (totals[category].y + parseFloat(String(item.sum))).toFixed(2)
    );
  }

  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
    },
    title: {
      text: '',
    },
    tooltip: {
      pointFormat: '{point.y} {series.name} ({point.percentage:.2f})%',
    },
    plotOptions: {
      pie: {
        borderWidth: 0,
        innerSize: '50%',
        allowPointSelect: true,
      },
    },
    series: [
      {
        name: currency,
        colorByPoint: true,
        data: Object.values(totals),
      },
    ] as Highcharts.SeriesOptionsType[],
    credits: {
      enabled: false,
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default Month;
