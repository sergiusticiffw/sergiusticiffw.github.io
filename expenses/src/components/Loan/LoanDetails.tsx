import React from 'react';

import { LoanCostBreakdown } from '@components/Loan/LoanCharts';
import AmortizationTable from '@components/Loan/AmortizationTable';

interface LoanDetailsProps {
  loan?: any;
  loanData: {
    principal: number;
    start_date: string;
  };
  amortizationSchedule?: any[];
  totalPaidAmount?: number;
}

const LoanDetails: React.FC<LoanDetailsProps> = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];
  const annualSummaries = loan?.annual_summaries ?? {};

  // Early return if no valid data
  if (!amortizationSchedule || amortizationSchedule.length === 0) {
    return (
      <div className="charts-page">
        <p>No amortization schedule data available.</p>
        <p>
          Debug info: amortizationSchedule length ={' '}
          {amortizationSchedule?.length || 0}
        </p>
      </div>
    );
  }

  const processedAmortizationSchedule = [];
  let currentYear = null;

  amortizationSchedule.forEach((paymentRow, index) => {
    // Handle different data structures
    let paymentDate: string;
    let paymentYear: string;

    if (Array.isArray(paymentRow)) {
      // Array format: [date, rate, installment, reduction, interest, principal, fee, ...]
      if (!paymentRow[0]) {
        console.warn('Invalid payment row found (missing date):', paymentRow);
        return;
      }
      paymentDate = paymentRow[0];
    } else if (typeof paymentRow === 'object' && paymentRow !== null) {
      // Object format: { date, rate, installment, ... }
      if (!paymentRow.date) {
        console.warn(
          'Invalid payment row found (missing date property):',
          paymentRow
        );
        return;
      }
      paymentDate = paymentRow.date;
    } else {
      console.warn('Invalid payment row format:', paymentRow);
      return;
    }

    // Skip if paymentDate is not a string
    if (typeof paymentDate !== 'string') {
      console.warn('Invalid payment date found:', paymentDate);
      return;
    }

    const dateParts = paymentDate.split('.');
    if (dateParts.length < 3) {
      console.warn('Invalid date format found:', paymentDate);
      return;
    }

    paymentYear = dateParts[2];

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

  const sumOfInterest = loan?.sum_of_interests + loan?.unpaid_interest;

  return (
    <div className="charts-page amortization-schedule">
      <LoanCostBreakdown
        data={{
          principal: props.loanData.principal,
          sumOfInterest,
          sumInstallments,
        }}
      />
      <br />

      <AmortizationTable amortizationSchedule={processedAmortizationSchedule} />
    </div>
  );
};

export default LoanDetails;
