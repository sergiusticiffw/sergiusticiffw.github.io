/**
 * UI-facing loan what-if helpers. All math goes through LoanSimulator
 * (same engine as the AI assistant tools) — nothing is persisted.
 */
import {
  ExtraStrategy,
  HypotheticalPayment,
  LoanSimulator,
  LoanSource,
  ScenarioResult,
  daysBetween,
  getLoanSimulator,
  monthsBetween,
  nextRegular,
  regularAfter,
} from '../../../ai/loanScenarios';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import { getLoanStatus } from '@shared/utils/utils';

export type SimulateMode =
  | 'one_time'
  | 'recurring'
  | 'rate'
  | 'finish_by'
  | 'compare';

export interface CompareMetrics {
  baseline: ScenarioResult;
  scenario: ScenarioResult;
  interestSaved: number;
  monthsSaved: number;
  daysSaved: number;
  installmentsSaved: number;
  baseNext: number | null;
  scenarioNext: number | null;
  installmentDrop: number | null;
}

export interface RecurringResult extends CompareMetrics {
  extraPaymentsMade: number;
  totalExtraPaid: number;
  everyMonths: number;
  firstExtraOn: string | null;
}

export interface RateResult extends CompareMetrics {
  effectiveFrom: string;
  installmentChange: number | null;
  interestChange: number;
  refinanceFee: number;
  netSaving: number | null;
  breakEvenMonths: number | null;
}

export interface FinishByResult {
  alreadyMet: boolean;
  feasible: boolean;
  requiredAmount: number | null;
  method: 'monthly_extra' | 'one_time';
  metrics: CompareMetrics | null;
  totalExtraPaid: number | null;
  note?: string;
}

export interface CompareLoanRow {
  id: string;
  name: string;
  rate: number;
  balance: number;
  interestSavedTerm: number;
  monthsSaved: number;
  interestSavedInstallment: number;
  installmentDrop: number;
  paysOff: boolean;
  isCurrent: boolean;
}

const remainingNow = (sim: LoanSimulator) => {
  const base = sim.baseline();
  const firstUnpaid = base.rows.find((row) => !row.paid);
  return firstUnpaid ? firstUnpaid.remaining + firstUnpaid.principal : 0;
};

const hypotheticalPaid = (result: ScenarioResult) =>
  result.rows
    .filter((row) => row.hypothetical)
    .reduce((sum, row) => sum + row.installment, 0);

export const compareMetrics = (
  baseline: ScenarioResult,
  scenario: ScenarioResult,
  afterDate?: string
): CompareMetrics => {
  const baseNext = afterDate
    ? regularAfter(baseline, afterDate)
    : nextRegular(baseline);
  const scenarioNext = afterDate
    ? regularAfter(scenario, afterDate)
    : nextRegular(scenario);
  const drop =
    baseNext && scenarioNext
      ? baseNext.installment - scenarioNext.installment
      : null;
  return {
    baseline,
    scenario,
    interestSaved: Math.max(0, baseline.totalInterest - scenario.totalInterest),
    monthsSaved: monthsBetween(scenario.payoffDate, baseline.payoffDate),
    daysSaved: daysBetween(scenario.payoffDate, baseline.payoffDate),
    installmentsSaved: baseline.regularLeft - scenario.regularLeft,
    baseNext: baseNext?.installment ?? null,
    scenarioNext: scenarioNext?.installment ?? null,
    installmentDrop: drop,
  };
};

export const recurringPayments = (
  sim: LoanSimulator,
  amount: number,
  everyMonths: number,
  from: string,
  until: string | null
): HypotheticalPayment[] => {
  const step = Math.min(24, Math.max(1, Math.floor(everyMonths) || 1));
  return sim
    .baseline()
    .rows.filter(
      (row) =>
        !row.paid &&
        !row.extra &&
        row.date >= from &&
        (!until || row.date <= until)
    )
    .filter((_, index) => index % step === 0)
    .map((row) => ({ date: row.date, amount }));
};

export const runOneTimeExtra = (
  sim: LoanSimulator,
  amount: number,
  date: string,
  strategy: ExtraStrategy
): CompareMetrics => {
  const baseline = sim.baseline();
  const scenario = sim.runExtra({ date, amount }, strategy);
  const applied = scenario.applied[scenario.applied.length - 1];
  return compareMetrics(baseline, scenario, applied);
};

export const runRecurringExtra = (
  sim: LoanSimulator,
  amount: number,
  everyMonths: number,
  from: string,
  until: string | null = null
): RecurringResult | null => {
  const payments = recurringPayments(sim, amount, everyMonths, from, until);
  if (!payments.length) return null;
  const baseline = sim.baseline();
  const scenario = sim.run({ payments });
  return {
    ...compareMetrics(baseline, scenario),
    extraPaymentsMade: scenario.rows.filter((row) => row.hypothetical).length,
    totalExtraPaid: hypotheticalPaid(scenario),
    everyMonths: Math.min(24, Math.max(1, Math.floor(everyMonths) || 1)),
    firstExtraOn: scenario.applied[0] || null,
  };
};

export const runRateChange = (
  sim: LoanSimulator,
  rate: number,
  date: string,
  keepInstallment: boolean,
  refinanceFee = 0
): RateResult => {
  const baseline = sim.baseline();
  const scenario = sim.run({
    rateChange: { date, rate, keepInstallment },
  });
  const effectiveFrom = scenario.rateDate || date;
  const metrics = compareMetrics(baseline, scenario, effectiveFrom);
  const interestChange = scenario.totalInterest - baseline.totalInterest;
  const installmentChange =
    metrics.baseNext != null && metrics.scenarioNext != null
      ? metrics.scenarioNext - metrics.baseNext
      : null;
  const fee = refinanceFee > 0 ? refinanceFee : 0;
  const netSaving =
    fee > 0 || interestChange !== 0 ? -interestChange - fee : null;
  const breakEvenMonths =
    fee > 0 && installmentChange != null && installmentChange < 0
      ? Math.ceil(fee / -installmentChange)
      : null;

  return {
    ...metrics,
    // Rate change may raise interest; keep raw interestSaved as "saved vs baseline"
    // only when positive; UI also shows interestChange.
    interestSaved: Math.max(0, -interestChange),
    effectiveFrom,
    installmentChange,
    interestChange,
    refinanceFee: fee,
    netSaving,
    breakEvenMonths,
  };
};

export const solveFinishBy = (
  sim: LoanSimulator,
  targetDate: string,
  method: 'monthly_extra' | 'one_time',
  fromDate: string
): FinishByResult => {
  const baseline = sim.baseline();
  if (baseline.payoffDate <= targetDate) {
    return {
      alreadyMet: true,
      feasible: true,
      requiredAmount: 0,
      method,
      metrics: null,
      totalExtraPaid: 0,
    };
  }

  const evaluate = (x: number): ScenarioResult => {
    if (x <= 0) return baseline;
    if (method === 'one_time') {
      return sim.runExtra({ date: fromDate, amount: x }, 'reduce_term');
    }
    return sim.run({
      payments: recurringPayments(sim, x, 1, fromDate, null),
    });
  };

  const met = (result: ScenarioResult) => result.payoffDate <= targetDate;

  let lo = 0;
  let hi = Math.max(1, remainingNow(sim));
  if (!met(evaluate(hi))) {
    return {
      alreadyMet: false,
      feasible: false,
      requiredAmount: null,
      method,
      metrics: null,
      totalExtraPaid: null,
      note:
        method === 'monthly_extra'
          ? 'unreachable_monthly'
          : 'unreachable_one_time',
    };
  }

  for (let i = 0; i < 32 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (met(evaluate(mid))) hi = mid;
    else lo = mid;
  }
  const step = hi > 1000 ? 10 : 1;
  const required = Math.ceil(hi / step) * step;
  const scenario = evaluate(required);

  return {
    alreadyMet: false,
    feasible: true,
    requiredAmount: required,
    method,
    metrics: compareMetrics(baseline, scenario),
    totalExtraPaid: hypotheticalPaid(scenario),
  };
};

export const compareLoansForExtra = (
  amount: number,
  date: string | undefined,
  currentLoanId: string,
  loans: ApiLoan[],
  payments: LoanPaymentsEntry[]
): CompareLoanRow[] => {
  const rows: CompareLoanRow[] = [];

  for (const loan of loans) {
    if (getLoanStatus(loan.fls as string | undefined) !== 'active') continue;
    const items = (payments.find((entry) => entry.loanId === loan.id)?.data ||
      []) as ApiPaymentItem[];
    const source: LoanSource = { loan, items };
    const sim = getLoanSimulator(source);
    if (!sim) continue;

    const payDate = date && date >= sim.startIso && date <= sim.endIso
      ? date
      : sim.defaultDate();
    if (payDate < sim.startIso || payDate > sim.endIso) continue;

    const baseline = sim.baseline();
    const term = sim.runExtra({ date: payDate, amount }, 'reduce_term');
    const inst = sim.runExtra({ date: payDate, amount }, 'reduce_installment');
    const applied = term.applied[0];
    const before = regularAfter(baseline, applied);
    const after = regularAfter(inst, applied);
    const balance = remainingNow(sim);
    const rate = Number(loan.fr);
    const currentRate = Number.isFinite(rate) ? rate : 0;

    rows.push({
      id: String(loan.id),
      name: (loan.title || 'Loan').trim() || 'Loan',
      rate: currentRate,
      balance,
      interestSavedTerm: Math.max(0, baseline.totalInterest - term.totalInterest),
      monthsSaved: monthsBetween(term.payoffDate, baseline.payoffDate),
      interestSavedInstallment: Math.max(
        0,
        baseline.totalInterest - inst.totalInterest
      ),
      installmentDrop:
        before && after ? Math.max(0, before.installment - after.installment) : 0,
      paysOff: amount >= balance - 1,
      isCurrent: String(loan.id) === String(currentLoanId),
    });
  }

  return rows.sort((a, b) => b.interestSavedTerm - a.interestSavedTerm);
};
