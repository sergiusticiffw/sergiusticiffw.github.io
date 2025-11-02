import React from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { getCategories } from '@utils/constants';
import { DataState } from '@type/types';
import './DailyAverage.scss';

const DailyAverage = () => {
  const { data } = useData() as DataState;
  const { t } = useLocalization();

  // Note: Component will re-render when data.raw or data.categoryTotals change naturally

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const daysPassed = calculateDaysFrom(firstDay);
  // Get localized categories
  const localizedCategories = getCategories();

  // Transform categoryTotals to use localized category names
  const localizedCategoryTotals = Object.values(data.categoryTotals || []).map(
    (item) => {
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
    }
  );

  const { sortedItems, requestSort, sortConfig } = useSortableData(
    localizedCategoryTotals
  );

  const totalDaily = data.totalSpent / daysPassed;

  return (
    <div className="daily-average-balanced">
      <div className="section-header">
        <h3>{t('home.dailyAveragePerCategory')}</h3>
      </div>

      <table className="balanced-table">
        <thead>
          <tr>
            <th>{t('common.category')}</th>
            <th
              onClick={() => requestSort('y')}
              className={`sortable ${getClassNamesFor(sortConfig, 'y')}`}
            >
              {t('home.dailyAverage')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, key) => {
            const dailyAmount = parseFloat(String(item.y / daysPassed)).toFixed(
              2
            );
            const percentage = ((item.y / data.totalSpent) * 100).toFixed(1);

            return (
              <tr key={key}>
                <td className="category-cell">
                  <span className="category-name">{item.name}</span>
                  <span className="category-percentage">({percentage}%)</span>
                </td>
                <td className="amount-cell">
                  {formatNumber(parseFloat(dailyAmount))} / {t('home.day')}
                </td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td className="total-label">{t('common.total')}</td>
            <td className="total-amount">
              {formatNumber(parseFloat(totalDaily.toFixed(2)))} /{' '}
              {t('home.day')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DailyAverage;
