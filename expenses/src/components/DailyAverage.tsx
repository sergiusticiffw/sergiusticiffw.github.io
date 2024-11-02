import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { AuthState, DataState } from '@type/types';
import { getIconForCategory } from '@utils/helper';

const DailyAverage = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data.raw, data.categoryTotals]);

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const daysPassed = calculateDaysFrom(firstDay);
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    Object.values(data.categoryTotals || [])
  );

  return (
    <>
      <span className="heading">Daily average per category</span>
      <table className="daily-average">
        <thead>
          <tr>
            <th>Category</th>
            <th
              onClick={() => requestSort('y')}
              className={`sortable ${getClassNamesFor(sortConfig, 'y')}`}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, key) => (
            <tr key={key}>
              <td className='icon'>
                {getIconForCategory(item.name)}
                {item.name}
              </td>
              <td>
                {formatNumber(
                  parseFloat(String(item.y / daysPassed)).toFixed(2)
                )}{' '}
                {currency} / day
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="average-spending">
        Average spending per day:{' '}
        {formatNumber(
          parseFloat(String(data.totalSpent / daysPassed)).toFixed(2)
        )}{' '}
        {currency}
      </div>
    </>
  );
};

export default DailyAverage;
