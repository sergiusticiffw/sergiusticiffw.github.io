import React from 'react';
import { useLocalization } from '@shared/context/localization';

import { LoanCostBreakdown } from '@features/loans/components/Loan/LoanCharts';
import AmortizationTable from '@features/loans/components/Loan/AmortizationTable';
import type {
  PaydownResult,
  PaymentLog,
} from '@features/loans/utils/amortization';

interface LoanDetailsProps {
  loan?: PaydownResult | null;
  loanData: {
    principal: number;
    start_date: string;
  };
  amortizationSchedule?: PaymentLog[];
  totalPaidAmount?: number;
}

const LoanDetails: React.FC<LoanDetailsProps> = (props) => {
  const { t } = useLocalization();
  const loan: PaydownResult | null = props?.loan ?? null;
  const amortizationSchedule = props?.amortizationSchedule ?? [];
  const annualSummaries = loan?.annual_summaries ?? {};

  // Early return if no valid data
  if (!amortizationSchedule || amortizationSchedule.length === 0) {
    return (
      <div className="charts-page">
        <p>{t('loan.noAmortizationData')}</p>
        <p>
          {t('loan.debugInfo')}: amortizationSchedule length ={' '}
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
    (loan?.sum_of_installments ?? 0) +
    (loan?.remaining_principal ?? 0) +
    (loan?.unpaid_interest ?? 0) +
    (loan?.sum_of_fees ?? 0);

  const sumOfInterest =
    (loan?.sum_of_interests ?? 0) + (loan?.unpaid_interest ?? 0);

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
