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
            </tr>
          </thead>
          <tbody>
            {amortizationSchedule?.map((element, index) => {
              // Check if this is an annual summary row
              if (element.type === 'annual_summary') {
                return (
                  <tr
                    key={`summary-fixed-${element.year}`}
                    className="annual-summary-row"
                  >
                    <td>Total {element.year}</td> {/* Display "Total YYYY" */}
                  </tr>
                );
              }

              // Regular payment row
              return (
                <tr
                  key={element[0] + '-' + index} // Use index as well if dates can repeat for uniqueness
                  data-id={element[0]}
                  className={element[7] ? 'was-payed' : null}
                >
                  <td>{element[0]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-scrollable">
        <table className="expenses-table" cellSpacing="0" cellPadding="0">
          <thead>
            <tr>
              <th>Rate</th>
              <th>Days</th>
              <th>Installment</th>
              <th>Reduction</th>
              <th>Interest</th>
              <th>Principal</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {amortizationSchedule?.map((element, index) => {
              // Check if this is an annual summary row
              if (element.type === 'annual_summary') {
                return (
                  <tr
                    key={`summary-scroll-${element.year}`}
                    className="annual-summary-row annual-summary-total"
                  >
                    <td>-</td> {/* Days column, N/A for summary */}
                    <td>-</td> {/* Days column, N/A for summary */}
                    <td>{formatNumber(element.totalPaid)}</td>{' '}
                    {/* Total Paid for the year */}
                    <td>{formatNumber(element.totalPrincipal)}</td>
                    <td>{formatNumber(element.totalInterest)}</td>
                    <td>-</td> {/* Principal remaining, N/A for summary */}
                    <td>{formatNumber(element.totalFees)}</td>
                  </tr>
                );
              }

              // Regular payment row
              return (
                <tr
                  key={element[0] + '-' + index} // Use index as well if dates can repeat for uniqueness
                  data-id={element[0]}
                  className={element[7] ? 'was-payed' : null}
                >
                  <td>{formatNumber(element[1])}</td>
                  <td>{formatNumber(element[8])}</td>
                  <td>{formatNumber(element[2])}</td>
                  <td>{formatNumber(element[3])}</td>
                  <td>{formatNumber(element[4])}</td>
                  <td>{formatNumber(element[5])}</td>
                  <td>{formatNumber(element[6])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizationScheduleTable;
