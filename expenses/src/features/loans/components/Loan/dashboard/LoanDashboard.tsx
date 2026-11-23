import React, { useMemo } from 'react';
import type { PaydownResult, PaymentLog } from '@features/loans/utils/amortization';
import {
  countRemainingPayments,
  getUpcomingPayments,
  getTotalInterest,
} from '@features/loans/utils/loanSimulation';
import LoanKpiCards from './LoanKpiCards';
import UpcomingPayments from './UpcomingPayments';

interface LoanDashboardProps {
  paydown: PaydownResult | null;
  schedule: PaymentLog[];
  loanStatus: string;
  totalPrincipal: number;
  totalPaidAmount: number;
  remainingDisplay: string;
  onAddPayment: () => void;
  detailRows: React.ReactNode;
}

const LoanDashboard: React.FC<LoanDashboardProps> = ({
  paydown,
  schedule,
  loanStatus,
  totalPrincipal,
  totalPaidAmount,
  remainingDisplay,
  onAddPayment,
  detailRows,
}) => {
  const isActive = loanStatus === 'active';

  const totalInterest = useMemo(() => getTotalInterest(paydown), [paydown]);
  const interestToPrincipalRatio = useMemo(
    () => (totalPrincipal > 0 ? (totalInterest / totalPrincipal) * 100 : 0),
    [totalInterest, totalPrincipal]
  );

  const upcomingPayment = useMemo(
    () => getUpcomingPayments(schedule, 1)[0] ?? null,
    [schedule]
  );

  const remainingPaymentsCount = useMemo(
    () => countRemainingPayments(schedule),
    [schedule]
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <LoanKpiCards
        principal={totalPrincipal}
        paidAmount={totalPaidAmount}
        remainingDisplay={remainingDisplay}
        interestToPrincipalRatio={interestToPrincipalRatio}
        loanStatus={loanStatus}
      />

      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        {detailRows}
      </div>

      {isActive && (
        <UpcomingPayments
          payment={upcomingPayment}
          remainingCount={remainingPaymentsCount}
          onAddPayment={onAddPayment}
        />
      )}
    </div>
  );
};

export default LoanDashboard;
