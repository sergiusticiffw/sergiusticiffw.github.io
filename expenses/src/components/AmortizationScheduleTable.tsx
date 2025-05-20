import React from 'react';
import { formatNumber } from '@utils/utils';

const AmortizationScheduleTable = ({ amortizationSchedule }) => {
  return (
    <div className="table-wrapper-loan">
      <div className="table-fixed">
        <table className="expenses-table" cellSpacing="0" cellPadding="0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {amortizationSchedule?.map((element) => (
              <tr
                key={element[0]}
                data-id={element[0]}
                className={element[7] ? 'was-payed' : null}
              >
                <td>{element[0]}</td>
                <td>{formatNumber(element[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-scrollable">
        <table className="expenses-table" cellSpacing="0" cellPadding="0">
          <thead>
            <tr>
              <th>Days</th>
              <th>Installment</th>
              <th>Reduction</th>
              <th>Interest</th>
              <th>Principal</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {amortizationSchedule?.map((element) => (
              <tr
                key={element[0]}
                data-id={element[0]}
                className={element[7] ? 'was-payed' : null}
              >
                <td>{formatNumber(element[8])}</td>
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
    </div>
  );
};

export default AmortizationScheduleTable;
