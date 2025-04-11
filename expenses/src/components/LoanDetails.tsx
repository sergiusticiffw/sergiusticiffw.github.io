import React from 'react';
import AmortizationScheduleTable from '@components/AmortizationScheduleTable';
import { formatNumber } from '@utils/utils';
import { LoanCostBreakdown } from '@components/LoanCharts';

const LoanDetails = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];

  const sumInstallments =
    loan?.sum_of_installments +
    loan?.remaining_principal +
    loan?.unpaid_interest +
    loan?.sum_of_fees;

  const payPerDay = sumInstallments / loan?.days_calculated;

  const sumOfInterest = loan?.sum_of_interests + loan?.unpaid_interest;
  return (
    <div className="charts-page">
      <LoanCostBreakdown
        data={{
          principal: props.loanData.principal,
          sumOfInterest,
          sumInstallments,
        }}
      />
      <br />

      <table className="daily-average">
        <tbody>
          <tr>
            <td>Principal</td>
            <td>{formatNumber(props.loanData.principal)}</td>
          </tr>
          <tr>
            <td>Sum of interests</td>
            <td>{formatNumber(sumOfInterest)}</td>
          </tr>
          <tr>
            <td>Sum of installments</td>
            <td>{formatNumber(sumInstallments)}</td>
          </tr>
          <tr>
            <td>Days calculated</td>
            <td>{formatNumber(loan?.days_calculated)}</td>
          </tr>
          <tr>
            <td>Start Date</td>
            <td>{props.loanData.start_date}</td>
          </tr>
          <tr>
            <td>Actual end date</td>
            <td>{loan?.actual_end_date}</td>
          </tr>
          <tr>
            <td>Latest payment date</td>
            <td>{loan?.latest_payment_date}</td>
          </tr>
          <tr>
            <td>Sum of fees</td>
            <td>{formatNumber(loan?.sum_of_fees)}</td>
          </tr>
          <tr>
            <td>Interest cost as % of total installments</td>
            <td>
              {formatNumber(
                ((sumOfInterest + loan?.sum_of_fees) / sumInstallments) * 100
              )}
            </td>
          </tr>
          <tr>
            <td>Cost of loan per day</td>
            <td>{formatNumber(payPerDay)}</td>
          </tr>
        </tbody>
      </table>

      <br />

      <AmortizationScheduleTable amortizationSchedule={amortizationSchedule} />
    </div>
  );
};

export default LoanDetails;
