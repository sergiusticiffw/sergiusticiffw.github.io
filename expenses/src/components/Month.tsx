import React from 'react';
import { useAuthState } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { categories } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';

interface MonthProps {
  items: TransactionOrIncomeItem[];
  month: string;
}

const Month: React.FC<MonthProps> = ({ items, month }) => {
  if (!items) return null;
  const { currency } = useAuthState() as AuthState;

  const totals = {};
  for (const item of items) {
    if (item.type === 'incomes') {
      continue;
    }
    // @ts-expect-error
    const category = categories.find(
      (element) => element.value === item.cat
    ).label;
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
      text: `${month}`,
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
