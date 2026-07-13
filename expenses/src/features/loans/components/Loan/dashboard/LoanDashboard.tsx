import React, { useMemo } from 'react';
import type { PaydownResult, PaymentLog } from '@features/loans/utils/amortization';
import {
  calculateMilestones,
  getUpcomingPayments,
  getTotalInterest,
} from '@features/loans/utils/loanSimulation';
import LoanKpiCards from './LoanKpiCards';
import LoanMilestones from './LoanMilestones';
import UpcomingPayments from './UpcomingPayments';

interface LoanDashboardProps {
  paydown: PaydownResult | null;
  schedule: PaymentLog[];
  loanStatus: string;
  progress: number;
  principalPaid: number;
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
  progress,
  principalPaid,
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

  const milestones = useMemo(
    () =>
      calculateMilestones(
        schedule,
        totalPrincipal,
        principalPaid,
        paydown?.remaining_principal_after_paid ?? paydown?.remaining_principal
      ),
    [schedule, totalPrincipal, principalPaid, paydown]
  );

  const upcomingPayment = useMemo(
    () => getUpcomingPayments(schedule, 1)[0] ?? null,
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
        <>
          <UpcomingPayments
            payment={upcomingPayment}
            onAddPayment={onAddPayment}
          />

          <LoanMilestones
            milestones={milestones}
            progress={
              milestones.every((m) => m.completed) ? 100 : progress
            }
          />
        </>
      )}

      {loanStatus === 'completed' && (
        <LoanMilestones milestones={milestones} progress={100} />
      )}
    </div>
  );
};

export default LoanDashboard;
