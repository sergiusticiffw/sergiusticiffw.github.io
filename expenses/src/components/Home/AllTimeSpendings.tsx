import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { getCategories } from '@utils/constants';
import { AuthState, DataState } from '@type/types';

const AllTimeSpendings = () => {
  // All time section
  const {
    data: { categoryTotals = {} },
    data,
  } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data, currency]);

  // Get localized categories
  const localizedCategories = getCategories();

  // Transform categoryTotals to use localized category names
  const items = categoryTotals
    ? Object.values(categoryTotals).map((item) => {
        // Try to find the category by matching the English name with the localized category
        const category = localizedCategories.find((cat) => {
          // Check if the item name matches the English label or value
          return (
            cat.value === item.name ||
            cat.label === item.name ||
            // Also check against the original English category names
            (cat.value === '2' && item.name === 'Entertainment') ||
            (cat.value === '3' && item.name === 'Food') ||
            (cat.value === '4' && item.name === 'Gifts') ||
            (cat.value === '5' && item.name === 'Household Items/Supplies') ||
            (cat.value === '6' && item.name === 'Housing') ||
            (cat.value === '7' && item.name === 'Medical / Healthcare') ||
            (cat.value === '9' && item.name === 'Transportation') ||
            (cat.value === '10' && item.name === 'Utilities') ||
            (cat.value === '1' && item.name === 'Clothing') ||
            (cat.value === '12' && item.name === 'Family') ||
            (cat.value === '8' && item.name === 'Personal') ||
            (cat.value === '11' && item.name === 'Travel') ||
            (cat.value === '13' && item.name === 'Investment')
          );
        });
        return {
          ...item,
          name: category ? category.label : item.name,
        };
      })
    : [];
  const allTimeSpendings: Highcharts.Options = {
    chart: {
      type: 'pie',
    },
    title: {
      text: t('home.allTimeSpendings'),
      verticalAlign: 'middle',
    },
    tooltip: {
      pointFormat: '{point.y} {series.name} ({point.percentage:.2f})%',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        innerSize: '70%',
        dataLabels: {
          enabled: false,
        },
      },
    },
    series: [
      {
        name: currency,
        type: 'pie',
        data: items,
      },
    ],
    credits: {
      enabled: false,
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={allTimeSpendings} />;
};

export default AllTimeSpendings;
