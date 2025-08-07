import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  PieChart,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { LoanCostBreakdown } from '@components/Loan/LoanCharts';
import AmortizationTable from '@components/Loan/AmortizationTable';
import { formatNumber } from '@utils/utils';

interface LoanDetailsProps {
  loan?: any;
  loanData: {
    principal: number;
    start_date: string;
  };
  amortizationSchedule?: any[];
  totalPaidAmount?: number;
  paydownResult?: any;
}

const LoanDetails: React.FC<LoanDetailsProps> = (props) => {
  const loan = props?.loan ?? {};
  const amortizationSchedule = props?.amortizationSchedule ?? [];
  const annualSummaries = props?.paydownResult?.annual_summaries ?? {};

  // Early return if no valid data
  if (!amortizationSchedule || amortizationSchedule.length === 0) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardContent className="text-center py-16">
          <div className="space-y-4">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Amortization Data
              </h3>
              <p className="text-muted-foreground">
                No amortization schedule data available for this loan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
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

    // Add annual summary if year changes
    if (currentYear !== paymentYear) {
      const yearSummary = annualSummaries[currentYear];
      if (yearSummary) {
        processedAmortizationSchedule.push({
          type: 'annual_summary',
          year: currentYear,
          totalPaid:
            yearSummary.total_principal +
            yearSummary.total_interest +
            yearSummary.total_fees,
          totalPrincipal: yearSummary.total_principal || 0,
          totalInterest: yearSummary.total_interest || 0,
          totalFees: yearSummary.total_fees || 0,
        });
      }
      currentYear = paymentYear;
    }

    // Add the payment row
    if (Array.isArray(paymentRow)) {
      processedAmortizationSchedule.push({
        date: paymentRow[0],
        rate: paymentRow[1],
        num_days: paymentRow[2],
        installment: paymentRow[3],
        reduction: paymentRow[4],
        interest: paymentRow[5],
        principal: paymentRow[6],
        fee: paymentRow[7],
        was_payed: paymentRow[8],
      });
    } else {
      processedAmortizationSchedule.push(paymentRow);
    }
  });

  // Add final year summary
  if (currentYear && annualSummaries[currentYear]) {
    const yearSummary = annualSummaries[currentYear];
    processedAmortizationSchedule.push({
      type: 'annual_summary',
      year: currentYear,
      totalPaid: yearSummary.total_paid || 0,
      totalPrincipal: yearSummary.total_principal || 0,
      totalInterest: yearSummary.total_interest || 0,
      totalFees: yearSummary.total_fees || 0,
    });
  }

  const sumOfInterest = props.paydownResult?.sum_of_interests || 0;
  const sumInstallments = props.paydownResult?.sum_of_installments || 0;

  return (
    <div className="space-y-6">
      {/* Loan Cost Breakdown Chart */}
      <div>
        <LoanCostBreakdown
          data={{
            principal: props.loanData.principal,
            sumOfInterest,
            sumInstallments,
          }}
        />
      </div>

      {/* Amortization Table */}
      <div>
        <AmortizationTable
          amortizationSchedule={processedAmortizationSchedule}
        />
      </div>
    </div>
  );
};

export default LoanDetails;
