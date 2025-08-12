import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { DataState } from '@type/types';
import './DailyAverage.scss';

const DailyAverage = () => {
  const { data } = useData() as DataState;

  useEffect(() => {}, [data.raw, data.categoryTotals]);

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const daysPassed = calculateDaysFrom(firstDay);
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    Object.values(data.categoryTotals || [])
  );

  const totalDaily = data.totalSpent / daysPassed;

  return (
    <div className="daily-average-balanced">
      <div className="section-header">
        <h3>Daily Average Per Category</h3>
      </div>
      
      <table className="balanced-table">
        <thead>
          <tr>
            <th>Category</th>
            <th
              onClick={() => requestSort('y')}
              className={`sortable ${getClassNamesFor(sortConfig, 'y')}`}
            >
              Daily Average
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, key) => {
            const dailyAmount = parseFloat(String(item.y / daysPassed)).toFixed(2);
            const percentage = ((item.y / data.totalSpent) * 100).toFixed(1);
            
            return (
              <tr key={key}>
                <td className="category-cell">
                  <span className="category-name">{item.name}</span>
                  <span className="category-percentage">({percentage}%)</span>
                </td>
                <td className="amount-cell">
                  {formatNumber(parseFloat(dailyAmount))} / day
                </td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td className="total-label">Total</td>
            <td className="total-amount">
              {formatNumber(parseFloat(totalDaily.toFixed(2)))} / day
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default DailyAverage;
