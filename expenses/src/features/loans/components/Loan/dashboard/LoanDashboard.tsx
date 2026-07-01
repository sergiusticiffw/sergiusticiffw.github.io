import React, { useMemo } from 'react';
import { useLocalization } from '@shared/context/localization';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import type { PaydownResult, PaymentLog } from '@features/loans/utils/amortization';
import { useLoanSimulation } from '@features/loans/hooks/useLoanSimulation';
import {
  calculateMilestones,
  getUpcomingPayments,
} from '@features/loans/utils/loanSimulation';
import { calculateLoanHealthScore } from '@features/loans/utils/loanInsights';
import LoanKpiCards from './LoanKpiCards';
import ExtraPaymentSimulator from './ExtraPaymentSimulator';
import LoanHealthScore from './LoanHealthScore';
import LoanMilestones from './LoanMilestones';
import UpcomingPayments from './UpcomingPayments';
import {
  LoanPrincipalInterestPie,
  LoanScenarioComparison,
} from '@features/loans/components/Loan/LoanCharts';

interface LoanDashboardProps {
  loan: ApiLoan;
  payments: ApiPaymentItem[];
  paydown: PaydownResult | null;
  schedule: PaymentLog[];
  loanStatus: string;
  progress: number;
  principalPaid: number;
  totalPrincipal: number;
  totalPaidAmount: number;
  remainingDisplay: string;
  customExtra: number;
  onExtraChange: (value: number) => void;
  onAddPayment: () => void;
  detailRows: React.ReactNode;
}

const LoanDashboard: React.FC<LoanDashboardProps> = ({
  loan,
  payments,
  paydown,
  schedule,
  loanStatus,
  progress,
  principalPaid,
  totalPrincipal,
  totalPaidAmount,
  remainingDisplay,
  customExtra,
  onExtraChange,
  onAddPayment,
  detailRows,
}) => {
  const { t } = useLocalization();
  const isActive = loanStatus === 'active';

  const simulation = useLoanSimulation(
    loan,
    payments,
    schedule,
    paydown,
    customExtra
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

  const upcomingPayments = useMemo(
    () => getUpcomingPayments(schedule, 4),
    [schedule]
  );

  const health = useMemo(
    () =>
      calculateLoanHealthScore({
        paydown,
        schedule,
        progress,
        payments,
        loan,
        totalPrincipal,
      }),
    [paydown, schedule, progress, payments, loan, totalPrincipal]
  );

  const scenarioChartData = useMemo(
    () =>
      simulation.scenarios.map((s) => ({
        id: s.id,
        label: s.label,
        extraMonthly: s.extraMonthly,
        totalInterest: s.result?.totalInterest ?? 0,
        monthsToPayoff: s.result?.monthsToPayoff ?? 0,
      })),
    [simulation.scenarios]
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <LoanKpiCards
        principal={totalPrincipal}
        paidAmount={totalPaidAmount}
        remainingDisplay={remainingDisplay}
        interestToPrincipalRatio={simulation.interestToPrincipalRatio}
        loanStatus={loanStatus}
      />

      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        {detailRows}
      </div>

      {isActive && (
        <>
          <UpcomingPayments
            payments={upcomingPayments}
            onAddPayment={onAddPayment}
          />

          <LoanHealthScore health={health} />

          <ExtraPaymentSimulator
            customExtra={customExtra}
            onExtraChange={onExtraChange}
            scenario={simulation.scenarioCustom}
            simulatorConfig={simulation.simulatorConfig}
          />

          <div>
            <h3 className="text-base font-semibold text-white m-0 mb-4">
              {t('loan.visualizations')}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <LoanPrincipalInterestPie
                  principal={totalPrincipal}
                  totalInterest={simulation.totalInterest}
                />
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <LoanScenarioComparison
                  scenarios={scenarioChartData}
                  customExtra={customExtra}
                />
              </div>
            </div>
          </div>

          <LoanMilestones
            milestones={milestones}
            progress={
              milestones.every((m) => m.completed)
                ? 100
                : progress
            }
          />

        </>
      )}

      {loanStatus === 'completed' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LoanHealthScore health={health} />
          <LoanMilestones milestones={milestones} progress={100} />
        </div>
      )}
    </div>
  );
};

export default LoanDashboard;
