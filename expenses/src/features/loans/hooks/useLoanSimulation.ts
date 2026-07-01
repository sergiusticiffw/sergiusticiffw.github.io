import { useMemo } from 'react';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import type { PaydownResult, PaymentLog } from '@features/loans/utils/amortization';
import {
  simulateExtraPayment,
  buildScenarioPresets,
  getEstimatedPayoffDate,
  getTotalInterest,
  getExtraPaymentSimulatorConfig,
  type SimulationResult,
  type ScenarioPreset,
  type ExtraPaymentSimulatorConfig,
} from '@features/loans/utils/loanSimulation';
import { extractLoanSnapshot } from '@features/loans/utils/loanSnapshot';

export interface LoanSimulationState {
  baseline: SimulationResult | null;
  scenarioCustom: SimulationResult | null;
  scenarios: ScenarioPreset[];
  simulatorConfig: ExtraPaymentSimulatorConfig;
  payoffDate: string | null;
  totalInterest: number;
  totalCost: number;
  interestToPrincipalRatio: number;
}

export function useLoanSimulation(
  loan: ApiLoan | null | undefined,
  payments: ApiPaymentItem[],
  baselineSchedule: PaymentLog[],
  baselinePaydown: PaydownResult | null,
  customExtra: number
): LoanSimulationState {
  return useMemo(() => {
    const snapshot =
      baselinePaydown && baselineSchedule.length > 0
        ? extractLoanSnapshot(loan, payments, baselinePaydown, baselineSchedule)
        : null;

    const simulatorConfig = getExtraPaymentSimulatorConfig(
      baselineSchedule,
      snapshot
    );
    const baseline = simulateExtraPayment(loan, payments, 0);
    const scenarioCustom = simulateExtraPayment(loan, payments, customExtra);

    const scenarios = buildScenarioPresets(
      loan,
      payments,
      baselineSchedule,
      customExtra,
      snapshot
    );

    const payoffDate =
      baseline?.payoffDate ?? getEstimatedPayoffDate(baselineSchedule);
    const totalInterest =
      baseline?.totalInterest ?? getTotalInterest(baselinePaydown);
    const principal =
      baselinePaydown?.effective_principal ??
      baseline?.paydown.effective_principal ??
      0;
    const totalCost = principal + totalInterest;
    const interestToPrincipalRatio =
      principal > 0 ? (totalInterest / principal) * 100 : 0;

    return {
      baseline,
      scenarioCustom,
      scenarios,
      simulatorConfig,
      payoffDate,
      totalInterest,
      totalCost,
      interestToPrincipalRatio,
    };
  }, [loan, payments, baselineSchedule, baselinePaydown, customExtra]);
}
