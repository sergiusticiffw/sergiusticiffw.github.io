import React from 'react';
import AmortizationScheduleTable from '@components/AmortizationScheduleTable';

const LoanDetails = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];

  return (
    <>
      <h2>Prediction for this loan</h2>
      <ul className="loan-details">
        <li>
          Sum of interests:{' '}
          {(loan?.sum_of_interests + loan?.unpaid_interest).toFixed(2)}
        </li>
        <li>
          Sum of reductions:{' '}
          {(loan?.sum_of_reductions + loan?.remaining_principal).toFixed(2)}
        </li>
        <li>
          Sum of installments:{' '}
          {(
            loan?.sum_of_installments +
            loan?.remaining_principal +
            loan?.unpaid_interest +
            loan?.sum_of_fees
          ).toFixed(2)}
        </li>
        <li>Days calculated: {loan?.days_calculated}</li>
        <li>Actual end date: {loan?.actual_end_date}</li>
        <li>Latest payment date: {loan?.latest_payment_date}</li>
        <li>Sum of fees: {loan?.sum_of_fees}</li>
      </ul>

      <AmortizationScheduleTable amortizationSchedule={amortizationSchedule} />
    </>
  );
};

export default LoanDetails;
