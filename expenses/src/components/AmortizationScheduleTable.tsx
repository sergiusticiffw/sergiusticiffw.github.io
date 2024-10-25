import React from 'react';
import { formatNumber } from '@utils/utils';

const AmortizationScheduleTable = ({ amortizationSchedule }) => {
  return (
    <div className="table-wrapper loan-table">
      <table className="expenses-table" cellSpacing="0" cellPadding="0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Rate</th>
            <th>Installment</th>
            <th>Reduction</th>
            <th>Interest</th>
            <th>Principal</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {amortizationSchedule?.map((element) => (
            <tr key={element[0]} data-id={element[0]}>
              <td>{element[0]}</td>
              <td>{formatNumber(element[1])}</td>
              <td>{formatNumber(element[2])}</td>
              <td>{formatNumber(element[3])}</td>
              <td>{formatNumber(element[4])}</td>
              <td>{formatNumber(element[5])}</td>
              <td>{formatNumber(element[6])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AmortizationScheduleTable;
