import React from 'react';
import AmortizationScheduleTable from '@components/AmortizationScheduleTable';
import { formatNumber } from '@utils/utils';

const LoanDetails = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];

  const sumInstallments =
    loan?.sum_of_installments +
    loan?.remaining_principal +
    loan?.unpaid_interest +
    loan?.sum_of_fees;

  const payPerDay = sumInstallments / loan?.days_calculated;

  return (
    <>
      <h2>Prediction for this loan</h2>
      <ul className="loan-details">
        <li>
          Sum of interests:{' '}
          {formatNumber(loan?.sum_of_interests + loan?.unpaid_interest)}
        </li>
        <li>Sum of installments: {formatNumber(sumInstallments)}</li>
        <li>Days calculated: {formatNumber(loan?.days_calculated)}</li>
        <li>Actual end date: {loan?.actual_end_date}</li>
        <li>Latest payment date: {loan?.latest_payment_date}</li>
        <li>Sum of fees: {formatNumber(loan?.sum_of_fees)}</li>
        <li>Cost of loan per day: {formatNumber(payPerDay)}</li>
      </ul>

      <AmortizationScheduleTable amortizationSchedule={amortizationSchedule} />
    </>
  );
};

export default LoanDetails;
