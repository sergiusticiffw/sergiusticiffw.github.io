import React, { useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { calculateDaysFrom, formatNumber } from '@shared/utils/utils';
import {
  getClassNamesFor,
  useSortableData,
} from '@shared/utils/useSortableData';
import { getCategories } from '@shared/utils/constants';

const DailyAverage = () => {
  const { data } = useExpenseData();
  const { t } = useLocalization();

  // Note: Component will re-render when data.raw or data.categoryTotals change naturally

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const daysPassed = calculateDaysFrom(firstDay);
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

  const totalDaily = data.totalSpent / daysPassed;

  return (
    <div className="my-6 md:my-4 overflow-hidden bg-transparent border-none shadow-none">
      <div className="flex justify-start items-center p-0 mb-3 bg-transparent border-none">
        <h3 className="m-0 text-[0.95rem] font-semibold text-white/70 uppercase tracking-wide">
          {t('home.dailyAveragePerCategory')}
        </h3>
      </div>

      <table className="w-full border-collapse bg-transparent">
        <thead>
          <tr className="border-b-0 bg-transparent">
            <th className="py-0 pr-0 pb-2 pl-0 bg-transparent text-lg font-semibold text-white text-left tracking-tight md:text-base">
              {t('common.category')}
            </th>
            <th
              onClick={() => requestSort('y')}
              className={`py-0 pr-0 pb-2 pl-0 bg-transparent font-semibold text-white/50 text-xs uppercase tracking-wider text-right md:text-[0.7rem] cursor-pointer hover:text-white/80 ${getClassNamesFor(sortConfig, 'y')}`}
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
              <tr key={key} className="border-b border-white/5 bg-transparent last:border-b-0">
                <td className="py-2.5 pt-4 border-b-0 align-middle bg-transparent text-left last:text-right">
                  <span className="block text-white/90 text-base font-medium text-left md:text-[0.9rem]">{item.name}</span>
                  <span className="block text-white/50 text-sm font-normal mt-0.5 text-left md:text-xs">({percentage}%)</span>
                </td>
                <td className="py-2.5 pt-4 border-b-0 align-middle bg-transparent text-white text-base font-semibold text-right md:text-[0.9rem]">
                  {formatNumber(parseFloat(dailyAmount))} / {t('home.day')}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-white/10 bg-transparent">
            <td className="py-2.5 border-b-0 align-middle bg-transparent text-white text-base font-bold uppercase tracking-wide md:text-[0.9rem]">
              {t('common.total')}
            </td>
            <td className="py-2.5 border-b-0 align-middle bg-transparent text-white text-base font-bold text-right md:text-[0.9rem]">
              {formatNumber(parseFloat(totalDaily.toFixed(2)))} / {t('home.day')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DailyAverage;
