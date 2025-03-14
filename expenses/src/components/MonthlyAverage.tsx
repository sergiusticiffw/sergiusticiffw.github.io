import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { formatNumber, getMonthsPassed } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { DataState } from '@type/types';

const MonthlyAverage = () => {
  const { data } = useData() as DataState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data.raw, data.categoryTotals]);

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthsPassed: number = getMonthsPassed(firstDay);
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    Object.values(data.categoryTotals || [])
  );

  return (
    <>
      <span className="heading">Monthly average per category</span>
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
              <td>{formatNumber(item.y / monthsPassed)} / month</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default MonthlyAverage;
