import React from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';

interface MonthProps {
  month: string;
}

const Month: React.FC<MonthProps> = ({ month }) => {
  const { data } = useData();
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
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
    // @ts-expect-error
    const category = localizedCategories.find(
      (element) => element.value === item.cat
    )?.label;
    // @ts-expect-error
    if (!totals[category]) {
      // @ts-expect-error
      totals[category] = { name: category, y: 0 };
    }
    // @ts-expect-error
    totals[category].y = parseFloat(
      // @ts-expect-error
      (totals[category].y + parseFloat(item.sum)).toFixed(2)
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
