import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { categories } from '@utils/constants';
import { AuthState, DataState } from '@type/types';
import { formatNumber } from '@utils/utils';

const LastMonth = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data.raw, currency]);

  const oneMonthAgo = new Date().setDate(new Date().getDate() - 30);
  const lastMonthTotals = {};
  let totalSpending = 0;
  for (const item of data.raw) {
    if (item.type === 'incomes') {
      continue;
    }
    const itemDate = new Date(item.dt);
    if (itemDate > new Date(oneMonthAgo)) {
      // @ts-expect-error
      const category = categories.find(
        (element) => element.value === item.cat
      ).label;
      // @ts-expect-error
      if (!lastMonthTotals[category]) {
        // @ts-expect-error
        lastMonthTotals[category] = { name: category, y: 0 };
      }
      totalSpending += parseFloat(item.sum);
      // @ts-expect-error
      lastMonthTotals[category].y = parseFloat(
        // @ts-expect-error
        (lastMonthTotals[category].y + parseFloat(item.sum)).toFixed(2)
      );
    }
  }

  console.log('Total spending:', totalSpending); // Output the total spending

  const lastMonthOptions = {
    chart: {
      type: 'pie',
    },
    title: {
      text: 'Last 30 days spendings',
    },
    tooltip: {
      pointFormat: '{point.y} {series.name} ({point.percentage:.2f})%',
    },
    plotOptions: {
      pie: {
        borderWidth: 0,
      },
    },
    series: [
      {
        name: currency,
        colorByPoint: true,
        data: Object.values(lastMonthTotals),
      },
    ],
    credits: {
      enabled: false,
    },
  };

  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={lastMonthOptions} />
      <div className="average-spending">
        Total spent: {formatNumber(totalSpending)} {currency}
      </div>
    </>
  );
};

export default LastMonth;
