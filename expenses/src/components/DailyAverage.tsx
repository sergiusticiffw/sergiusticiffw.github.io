import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { DataState } from '@type/types';

const DailyAverage = () => {
  const { data } = useData() as DataState;

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
              <td>{item.name}</td>
              <td>
                {formatNumber(
                  parseFloat(String(item.y / daysPassed)).toFixed(2)
                )}{' '}
                / day
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
      </div>
    </>
  );
};

export default DailyAverage;
