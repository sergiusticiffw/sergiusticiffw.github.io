import React from 'react';
import AmortizationScheduleTable from '@components/Loan/AmortizationScheduleTable';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { LoanCostBreakdown } from '@components/Loan/LoanCharts';
import { LoanProgress } from '@components/Loan/LoanProgress';
import AmortizationTable from '@components/Loan/AmortizationTable';

const LoanDetails = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];
  const totalPaidAmount = props?.totalPaidAmount;
  const annualSummaries = loan.annual_summaries;

  const processedAmortizationSchedule = [];
  let currentYear = null;

  amortizationSchedule.forEach((paymentRow, index) => {
    const paymentDate = paymentRow[0];
    const paymentYear = paymentDate.split('.')[2];

    if (currentYear === null) {
      currentYear = paymentYear;
    }

    if (
      paymentYear !== currentYear ||
      index === amortizationSchedule.length - 1
    ) {
      if (paymentYear !== currentYear) {
        const summaryForPreviousYear = annualSummaries[currentYear];
        if (summaryForPreviousYear) {
          processedAmortizationSchedule.push({
            type: 'annual_summary',
            year: currentYear,
            totalPrincipal: summaryForPreviousYear.total_principal,
            totalInterest: summaryForPreviousYear.total_interest,
            totalFees: summaryForPreviousYear.total_fees,
            totalPaid:
              summaryForPreviousYear.total_principal +
              summaryForPreviousYear.total_interest +
              summaryForPreviousYear.total_fees,
          });
        }
        currentYear = paymentYear;
      }
    }
    processedAmortizationSchedule.push(paymentRow);

    if (
      index === amortizationSchedule.length - 1 &&
      processedAmortizationSchedule[processedAmortizationSchedule.length - 1]
        .type !== 'annual_summary'
    ) {
      const summaryForCurrentYear = annualSummaries[currentYear];
      if (summaryForCurrentYear) {
        processedAmortizationSchedule.push({
          type: 'annual_summary',
          year: currentYear,
          totalPrincipal: summaryForCurrentYear.total_principal,
          totalInterest: summaryForCurrentYear.total_interest,
          totalFees: summaryForCurrentYear.total_fees,
          totalPaid:
            summaryForCurrentYear.total_principal +
            summaryForCurrentYear.total_interest +
            summaryForCurrentYear.total_fees,
        });
      }
    }
  });

  const sumInstallments =
    loan?.sum_of_installments +
    loan?.remaining_principal +
    loan?.unpaid_interest +
    loan?.sum_of_fees;

  const payPerDay = sumInstallments / loan?.days_calculated;

  const sumOfInterest = loan?.sum_of_interests + loan?.unpaid_interest;

  const [day, month, year] = props.loanData.start_date.split('.');
  const formatted = `${year}-${month}-${day}`;

  const totalDays = loan?.days_calculated ?? 0;
  const daysSince = calculateDaysFrom(formatted);
  const daysPassed = daysSince > 0 ? Math.min(daysSince, totalDays) : 0;
  const daysRemaining = Math.max(totalDays - daysPassed, 0);

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
            <td>{formatNumber(totalDays)}</td>
          </tr>
          <tr>
            <td>Days Remaining</td>
            <td>{formatNumber(daysRemaining)}</td>
          </tr>
          <tr>
            <td>Start Date</td>
            <td>{props.loanData.start_date}</td>
          </tr>
          <tr>
            <td>Days Passed</td>
            <td>{formatNumber(daysPassed)}</td>
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
      <div className="charts-section">
        <LoanProgress
          data={{
            totalPaidAmount,
            sumInstallments,
          }}
        />
      </div>
      <br />

      <AmortizationTable amortizationSchedule={processedAmortizationSchedule} />

      {/*<AmortizationScheduleTable*/}
      {/*  amortizationSchedule={processedAmortizationSchedule}*/}
      {/*/>*/}
    </div>
  );
};

export default LoanDetails;
