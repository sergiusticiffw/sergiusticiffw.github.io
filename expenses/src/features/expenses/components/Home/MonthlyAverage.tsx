import React, { useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { formatNumber, getMonthsPassed } from '@shared/utils/utils';
import {
  getClassNamesFor,
  useSortableData,
} from '@shared/utils/useSortableData';
import { getCategories } from '@shared/utils/constants';
import './MonthlyAverage.scss';

const MonthlyAverage = () => {
  const { data } = useExpenseData();
  const { t } = useLocalization();

  // Note: Component will re-render when data.raw or data.categoryTotals change naturally

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthsPassed: number = getMonthsPassed(firstDay);
  // Get localized categories
  const localizedCategories = getCategories();

  // Transform categoryTotals to use localized category names
  const localizedCategoryTotals = useMemo(() => {
    return Object.values(data.categoryTotals || []).map((item) => {
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
    });
  }, [data.categoryTotals, localizedCategories]);

  const { sortedItems, requestSort, sortConfig } = useSortableData(
    localizedCategoryTotals
  );

  const totalMonthly = data.totalSpent / monthsPassed;

  return (
    <div className="monthly-average-balanced">
      <div className="section-header">
        <h3>{t('home.monthlyAveragePerCategory')}</h3>
      </div>

      <table className="balanced-table">
        <thead>
          <tr>
            <th>{t('common.category')}</th>
            <th
              onClick={() => requestSort('y')}
              className={`sortable ${getClassNamesFor(sortConfig, 'y')}`}
            >
              {t('home.monthlyAverage')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, key) => {
            const monthlyAmount = item.y / monthsPassed;
            const percentage = ((item.y / data.totalSpent) * 100).toFixed(1);

            return (
              <tr key={key}>
                <td className="category-cell">
                  <span className="category-name">{item.name}</span>
                  <span className="category-percentage">({percentage}%)</span>
                </td>
                <td className="amount-cell">
                  {formatNumber(monthlyAmount)} / {t('home.month')}
                </td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td className="total-label">{t('common.total')}</td>
            <td className="total-amount">
              {formatNumber(parseFloat(totalMonthly.toFixed(2)))} /{' '}
              {t('home.month')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyAverage;
