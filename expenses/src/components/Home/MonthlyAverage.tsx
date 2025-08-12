import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { formatNumber, getMonthsPassed } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { DataState } from '@type/types';
import './MonthlyAverage.scss';

const MonthlyAverage = () => {
  const { data } = useData() as DataState;

  useEffect(() => {}, [data.raw, data.categoryTotals]);

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const monthsPassed: number = getMonthsPassed(firstDay);
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    Object.values(data.categoryTotals || [])
  );

  const totalMonthly = data.totalSpent / monthsPassed;

  return (
    <div className="monthly-average-balanced">
      <div className="section-header">
        <h3>Monthly Average Per Category</h3>
      </div>
      
      <table className="balanced-table">
        <thead>
          <tr>
            <th>Category</th>
            <th
              onClick={() => requestSort('y')}
              className={`sortable ${getClassNamesFor(sortConfig, 'y')}`}
            >
              Monthly Average
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
                  {formatNumber(monthlyAmount)} / month
                </td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td className="total-label">Total</td>
            <td className="total-amount">
              {formatNumber(parseFloat(totalMonthly.toFixed(2)))} / month
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyAverage;
