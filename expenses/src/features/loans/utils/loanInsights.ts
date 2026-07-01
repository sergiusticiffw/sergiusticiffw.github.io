/**
 * Template-based loan insights, health score, and recommendations.
 * No external AI — deterministic from loan metrics.
 */
import type { PaydownResult, PaymentLog } from './paydown-node';
import type { SimulationResult } from './loanSimulation';
import { getTotalInterest } from './loanSimulation';
import { calculateInterestSavings } from './amortization';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';

export type HealthBand = 'excellent' | 'moderate' | 'needs_attention';

export interface LoanHealthScoreResult {
  score: number;
  band: HealthBand;
  explanationKey: string;
}

export interface SmartInsight {
  id: string;
  icon: 'zap' | 'trending' | 'target' | 'calendar';
  messageKey: string;
  params: Record<string, string | number>;
  highlightKeys?: string[];
}

export interface LoanRecommendation {
  id: string;
  icon: 'dollar' | 'calendar' | 'percent' | 'trending';
  messageKey: string;
  params: Record<string, string | number>;
}

export interface LoanInsightsInput {
  loan: ApiLoan | null | undefined;
  payments: ApiPaymentItem[];
  paydown: PaydownResult | null;
  schedule: PaymentLog[];
  progress: number;
  principalPaid: number;
  totalPrincipal: number;
  payoffDate: string | null;
  scenario100: SimulationResult | null;
  scenarioCustom: SimulationResult | null;
  customExtra: number;
}

function getInterestRatio(
  totalInterest: number,
  totalPrincipal: number
): number {
  if (totalPrincipal <= 0) return 1;
  return totalInterest / totalPrincipal;
}

function getPaymentConsistency(schedule: PaymentLog[]): number {
  const rows = schedule.filter(
    (r) => !('type' in r && (r as { type?: string }).type === 'annual_summary')
  );
  if (!rows.length) return 0.5;

  const dueRows = rows.filter((r) => {
    const inst =
      typeof r.installment === 'number'
        ? r.installment
        : Number(r.installment);
    return Number.isFinite(inst) && inst > 0;
  });

  if (!dueRows.length) return 0.5;

  const paidCount = dueRows.filter((r) => r.was_payed === true).length;
  return paidCount / dueRows.length;
}

export function calculateLoanHealthScore(
  input: Pick<
    LoanInsightsInput,
    'paydown' | 'schedule' | 'progress' | 'payments' | 'loan' | 'totalPrincipal'
  >
): LoanHealthScoreResult {
  const { paydown, schedule, progress, payments, loan, totalPrincipal } = input;

  const totalInterest = getTotalInterest(paydown);
  const interestRatio = getInterestRatio(totalInterest, totalPrincipal);
  const hasExtra =
    calculateInterestSavings(loan, payments) > 0 ||
    payments.some((p) => Number(p.fisp ?? 0) !== 0);
  const consistency = getPaymentConsistency(schedule);

  // Repayment progress: 0-30
  const progressScore = (Math.min(100, Math.max(0, progress)) / 100) * 30;

  // Interest burden: 0-25 (lower ratio = better)
  const interestScore = Math.max(0, 25 - interestRatio * 25);

  // Payment consistency: 0-25
  const consistencyScore = consistency * 25;

  // Extra payments: 0-20
  const extraScore = hasExtra ? 20 : Math.min(10, progress / 10);

  const score = Math.round(
    Math.min(100, Math.max(0, progressScore + interestScore + consistencyScore + extraScore))
  );

  let band: HealthBand = 'needs_attention';
  let explanationKey = 'loan.health.explanation.needsAttention';

  if (score >= 75) {
    band = 'excellent';
    explanationKey = 'loan.health.explanation.excellent';
  } else if (score >= 40) {
    band = 'moderate';
    explanationKey = 'loan.health.explanation.moderate';
  }

  return { score, band, explanationKey };
}

export function generateSmartInsights(
  input: LoanInsightsInput
): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const totalInterest = getTotalInterest(input.paydown);
  const extra = input.customExtra > 0 ? input.scenarioCustom : input.scenario100;
  const extraAmount = input.customExtra > 0 ? input.customExtra : 100;

  if (totalInterest > 0) {
    insights.push({
      id: 'interest-pace',
      icon: 'zap',
      messageKey: 'loan.insight.interestPace',
      params: {
        interest: Math.round(totalInterest),
        extra: extraAmount,
        months: extra?.monthsSaved ?? 0,
        savings: Math.round(extra?.interestSaved ?? 0),
      },
      highlightKeys: ['interest', 'extra', 'months', 'savings'],
    });
  }

  if (input.payoffDate) {
    insights.push({
      id: 'payoff-track',
      icon: 'calendar',
      messageKey: 'loan.insight.payoffTrack',
      params: { date: input.payoffDate },
      highlightKeys: ['date'],
    });
  }

  if (input.progress > 0 && input.progress < 100) {
    insights.push({
      id: 'progress',
      icon: 'target',
      messageKey: 'loan.insight.progress',
      params: { percent: Math.round(input.progress) },
      highlightKeys: ['percent'],
    });
  }

  if ((extra?.interestSaved ?? 0) > 0) {
    insights.push({
      id: 'extra-savings',
      icon: 'trending',
      messageKey: 'loan.insight.extraSavings',
      params: {
        extra: extraAmount,
        savings: Math.round(extra?.interestSaved ?? 0),
        months: extra?.monthsSaved ?? 0,
      },
      highlightKeys: ['extra', 'savings', 'months'],
    });
  }

  return insights.slice(0, 3);
}

export function generateRecommendations(
  input: LoanInsightsInput
): LoanRecommendation[] {
  const recs: LoanRecommendation[] = [];
  const totalInterest = getTotalInterest(input.paydown);

  const plus50Savings =
    input.scenarioCustom && input.customExtra >= 50
      ? input.scenarioCustom.interestSaved
      : input.scenario100?.interestSaved
        ? Math.round((input.scenario100.interestSaved / 100) * 50)
        : 0;

  if (plus50Savings > 0) {
    recs.push({
      id: 'add-50',
      icon: 'dollar',
      messageKey: 'loan.rec.add50',
      params: { savings: Math.round(plus50Savings) },
    });
  }

  if (input.payoffDate) {
    recs.push({
      id: 'on-track',
      icon: 'calendar',
      messageKey: 'loan.rec.onTrack',
      params: { date: input.payoffDate },
    });
  }

  // Principal portion of remaining payments
  const remainingPrincipal = input.paydown?.remaining_principal ?? 0;
  const remainingInterest = input.paydown?.unpaid_interest ?? 0;
  const remainingTotal = remainingPrincipal + remainingInterest;
  if (remainingTotal > 0 && input.progress < 100) {
    const principalPct = Math.round(
      (remainingPrincipal / remainingTotal) * 100
    );
    recs.push({
      id: 'principal-portion',
      icon: 'percent',
      messageKey: 'loan.rec.principalPortion',
      params: { percent: principalPct },
    });
  }

  if (totalInterest > 0 && input.scenario100 && input.scenario100.interestSaved > 0) {
    recs.push({
      id: 'extra-100',
      icon: 'trending',
      messageKey: 'loan.rec.extra100',
      params: {
        savings: Math.round(input.scenario100.interestSaved),
        months: input.scenario100.monthsSaved,
      },
    });
  }

  if (input.progress >= 75) {
    recs.push({
      id: 'almost-done',
      icon: 'target',
      messageKey: 'loan.rec.almostDone',
      params: { percent: Math.round(100 - input.progress) },
    });
  }

  return recs.slice(0, 5);
}
