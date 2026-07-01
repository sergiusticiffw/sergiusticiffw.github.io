/**
 * Loan simulation utilities for extra-payment "what-if" scenarios.
 * Uses the existing Paydown engine — pure and memoizable.
 */
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
  getNextRegularPayment,
} from './amortization';
import type { PaydownEvent, PaydownResult, PaymentLog } from './paydown-node';
import {
  extractLoanSnapshot,
  getRecurringBaseFromRow,
  type LoanPaymentSnapshot,
  type PaymentMethod,
} from './loanSnapshot';

export interface SimulationResult {
  paydown: PaydownResult;
  schedule: PaymentLog[];
  payoffDate: string | null;
  totalInterest: number;
  totalCost: number;
  monthsToPayoff: number;
  monthsSaved: number;
  interestSaved: number;
}

export interface UpcomingPayment {
  date: string;
  installment: number;
  daysUntil: number;
  isOverdue: boolean;
}

export interface LoanMilestone {
  id: '25' | '50' | '75' | '100';
  label: string;
  percent: number;
  date: string | null;
  completed: boolean;
}

function parseScheduleInstallment(
  value: number | string | undefined
): number | null {
  if (value == null || value === '-' || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function parseScheduleDateToUtcMs(date: string): number | null {
  const parts = (date ?? '').split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function parseSchedulePrincipal(value: number | string | undefined): number {
  if (value == null || value === '-' || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function isScheduleRow(row: PaymentLog | { type?: string }): row is PaymentLog {
  return !('type' in row && (row as { type?: string }).type === 'annual_summary');
}

export interface ExtraPaymentPreset {
  amount: number;
  /** e.g. "+10%" — null for the zero option */
  percentLabel: string | null;
}

export interface ExtraPaymentSimulatorConfig {
  baseInstallment: number;
  presets: ExtraPaymentPreset[];
  maxExtra: number;
  step: number;
  paymentMethod: PaymentMethod;
}

function roundNiceAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 10) return Math.max(1, Math.round(value));
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 1000) return Math.round(value / 10) * 10;
  if (value < 10000) return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}

/** Presets derived from next installment after last recorded payment. */
export function getExtraPaymentSimulatorConfig(
  schedule: PaymentLog[],
  snapshot?: LoanPaymentSnapshot | null
): ExtraPaymentSimulatorConfig {
  const next = getNextRegularPayment(schedule);
  const baseInstallment = snapshot?.nextInstallment ?? next?.installment ?? 0;
  const paymentMethod = snapshot?.paymentMethod ?? 'equal_installment';

  if (baseInstallment <= 0) {
    return {
      baseInstallment: 0,
      presets: [{ amount: 0, percentLabel: null }],
      maxExtra: 0,
      step: 1,
      paymentMethod,
    };
  }

  const percents = [10, 25, 50];
  const presetAmounts = percents.map((pct) =>
    Math.max(1, roundNiceAmount((baseInstallment * pct) / 100))
  );

  const presets: ExtraPaymentPreset[] = [
    { amount: 0, percentLabel: null },
    ...presetAmounts.map((amount, i) => ({
      amount,
      percentLabel: `+${percents[i]}%`,
    })),
  ];

  // Deduplicate amounts while keeping first label
  const seen = new Set<number>();
  const uniquePresets = presets.filter((p) => {
    if (seen.has(p.amount)) return false;
    seen.add(p.amount);
    return true;
  });

  const maxExtra = Math.max(
    roundNiceAmount(baseInstallment * 2),
    uniquePresets[uniquePresets.length - 1]?.amount ?? baseInstallment
  );
  const step = Math.max(1, roundNiceAmount(baseInstallment * 0.05));

  return {
    baseInstallment,
    presets: uniquePresets,
    maxExtra,
    step,
    paymentMethod,
  };
}

function countRemainingInstallments(schedule: PaymentLog[]): number {
  let count = 0;

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (!row.date) continue;

    const principal = parseSchedulePrincipal(row.principal);
    if (principal <= 0.01) break;

    if (row.was_payed === true) continue;

    const installment = parseScheduleInstallment(row.installment);
    if (installment != null) count++;
  }

  return count;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareScheduleDates(a: string, b: string): number {
  const ams = parseScheduleDateToUtcMs(a) ?? 0;
  const bms = parseScheduleDateToUtcMs(b) ?? 0;
  return ams - bms;
}

function isOnOrAfterScheduleDate(
  date: string,
  fromDate: string | null
): boolean {
  if (!fromDate) return false;
  return compareScheduleDates(date, fromDate) >= 0;
}

/** Add extra to future fnra events already recorded in payment history. */
function applyExtraToBaseEvents(
  baseEvents: PaydownEvent[],
  extraMonthly: number,
  fromDate: string
): PaydownEvent[] {
  if (extraMonthly <= 0) return baseEvents;

  return baseEvents.map((event) => {
    if (!event.date || !isOnOrAfterScheduleDate(event.date, fromDate)) {
      return event;
    }
    if (!Object.prototype.hasOwnProperty.call(event, 'recurring_amount')) {
      return event;
    }
    const amount = event.recurring_amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return event;

    return {
      ...event,
      recurring_amount: roundCents(amount + extraMonthly),
    };
  });
}

/**
 * Re-apply extra when projected recurring base changes (rate change, refinance).
 * Skips dates that already have fnra in payment history (handled by applyExtraToBaseEvents).
 */
function buildRecurringBumpEvents(
  schedule: PaymentLog[],
  snapshot: LoanPaymentSnapshot,
  extraMonthly: number,
  fnraDates: Set<string>
): PaydownEvent[] {
  if (extraMonthly <= 0) return [];

  const { nextPaymentDate, paymentMethod } = snapshot;
  const events: PaydownEvent[] = [];
  let lastBase: number | null = null;

  for (const row of schedule) {
    if (!isScheduleRow(row) || row.was_payed === true) continue;
    if (!row.date || !isOnOrAfterScheduleDate(row.date, nextPaymentDate)) {
      continue;
    }

    const principal = parseSchedulePrincipal(row.principal);
    if (principal <= 0.01) break;

    const base = getRecurringBaseFromRow(row, paymentMethod);
    if (base == null) continue;

    const baseChanged =
      lastBase == null || Math.abs(base - lastBase) > 0.01;

    if (baseChanged) {
      if (!fnraDates.has(row.date)) {
        events.push({
          date: row.date,
          recurring_amount: roundCents(base + extraMonthly),
          isSimulatedPayment: true,
          event_order: -1,
        });
      }
      lastBase = base;
    }
  }

  return events;
}

/**
 * Build event list for extra-monthly scenario from last-payment snapshot.
 * Same dual-Paydown pattern as calculateInterestSavings.
 */
export function buildExtraScenarioEvents(
  snapshot: LoanPaymentSnapshot,
  schedule: PaymentLog[],
  baseEvents: PaydownEvent[],
  extraMonthly: number
): PaydownEvent[] {
  if (extraMonthly <= 0) return baseEvents;

  const { nextPaymentDate, recurringBase } = snapshot;

  const fnraDates = new Set<string>();
  for (const event of baseEvents) {
    if (
      event.date &&
      Object.prototype.hasOwnProperty.call(event, 'recurring_amount') &&
      isOnOrAfterScheduleDate(event.date, nextPaymentDate)
    ) {
      fnraDates.add(event.date);
    }
  }

  const modifiedBaseEvents = applyExtraToBaseEvents(
    baseEvents,
    extraMonthly,
    nextPaymentDate
  );

  const bumpEvents = buildRecurringBumpEvents(
    schedule,
    snapshot,
    extraMonthly,
    fnraDates
  );

  // Ensure first bump at next payment uses snapshot recurring base (not stale schedule guess)
  const hasBumpAtNext = bumpEvents.some((e) => e.date === nextPaymentDate);
  if (!fnraDates.has(nextPaymentDate) && !hasBumpAtNext) {
    bumpEvents.unshift({
      date: nextPaymentDate,
      recurring_amount: roundCents(recurringBase + extraMonthly),
      isSimulatedPayment: true,
      event_order: -1,
    });
  }

  return [...modifiedBaseEvents, ...bumpEvents];
}

export function getTotalInterest(paydown: PaydownResult | null): number {
  if (!paydown) return 0;
  return (paydown.sum_of_interests ?? 0) + (paydown.unpaid_interest ?? 0);
}

export function getEstimatedPayoffDate(schedule: PaymentLog[]): string | null {
  if (!schedule.length) return null;

  let lastDate: string | null = null;
  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (!row.date) continue;
    const principal = parseSchedulePrincipal(row.principal);
    lastDate = row.date;
    if (principal <= 0.01) return row.date;
  }

  return lastDate;
}

export function getMonthsBetweenDates(
  fromDate: string,
  toDate: string
): number {
  const fromMs = parseScheduleDateToUtcMs(fromDate);
  const toMs = parseScheduleDateToUtcMs(toDate);
  if (fromMs == null || toMs == null) return 0;
  const diffDays = Math.max(0, (toMs - fromMs) / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 30);
}

function todayDdMmYyyy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function getDaysUntil(date: string): number {
  const targetMs = parseScheduleDateToUtcMs(date);
  const todayMs = parseScheduleDateToUtcMs(todayDdMmYyyy());
  if (targetMs == null || todayMs == null) return 0;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

export function getUpcomingPayments(
  schedule: PaymentLog[],
  count = 4
): UpcomingPayment[] {
  const results: UpcomingPayment[] = [];

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (row.was_payed === true) continue;
    const installment = parseScheduleInstallment(row.installment);
    if (installment == null || !row.date) continue;

    const daysUntil = getDaysUntil(row.date);
    results.push({
      date: row.date,
      installment,
      daysUntil,
      isOverdue: daysUntil < 0,
    });

    if (results.length >= count) break;
  }

  return results;
}

/** Unpaid installment rows only — excludes rate-change / refinance log markers. */
export function getScenarioPreviewRows(
  schedule: PaymentLog[],
  limit = 8
): PaymentLog[] {
  const results: PaymentLog[] = [];

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (row.was_payed === true) continue;
    const installment = parseScheduleInstallment(row.installment);
    if (installment == null || !row.date) continue;

    results.push(row);
    if (results.length >= limit) break;
  }

  return results;
}

export function calculateMilestones(
  schedule: PaymentLog[],
  totalPrincipal: number,
  principalPaid: number,
  remainingPrincipal?: number
): LoanMilestone[] {
  const thresholds: Array<{ id: LoanMilestone['id']; percent: number }> = [
    { id: '25', percent: 25 },
    { id: '50', percent: 50 },
    { id: '75', percent: 75 },
    { id: '100', percent: 100 },
  ];

  if (totalPrincipal <= 0) {
    return thresholds.map((t) => ({
      id: t.id,
      label: `${t.percent}%`,
      percent: t.percent,
      date: null,
      completed: false,
    }));
  }

  const progressPercent = Math.min(100, (principalPaid / totalPrincipal) * 100);

  const loanPaidOff =
    (remainingPrincipal != null && remainingPrincipal <= 0.01) ||
    schedule.some(
      (row) =>
        isScheduleRow(row) &&
        row.was_payed === true &&
        parseSchedulePrincipal(row.principal) <= 0.01
    );

  // Walk schedule to find when cumulative principal paid crosses each threshold
  const milestoneDates: Record<string, string | null> = {};
  let cumulativePrincipalPaid = 0;
  const initialPrincipal = totalPrincipal;

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    const rowPrincipal = parseSchedulePrincipal(row.principal);

    if (row.was_payed === true) {
      cumulativePrincipalPaid = Math.max(
        cumulativePrincipalPaid,
        initialPrincipal - rowPrincipal
      );

      for (const t of thresholds) {
        const target = (t.percent / 100) * totalPrincipal;
        if (milestoneDates[t.id] == null && cumulativePrincipalPaid >= target) {
          milestoneDates[t.id] = row.date ?? null;
        }
      }
    } else if (row.date) {
      const paidAtRow = initialPrincipal - rowPrincipal;

      for (const t of thresholds) {
        const target = (t.percent / 100) * totalPrincipal;
        if (milestoneDates[t.id] == null && paidAtRow >= target) {
          milestoneDates[t.id] = row.date;
        }
      }
    }
  }

  return thresholds.map((t) => ({
    id: t.id,
    label: `${t.percent}%`,
    percent: t.percent,
    date: milestoneDates[t.id] ?? null,
    completed: loanPaidOff || progressPercent >= t.percent,
  }));
}

export function simulateExtraPayment(
  loan: ApiLoan | null | undefined,
  payments: ApiPaymentItem[],
  extraMonthly: number
): SimulationResult | null {
  const loanData = buildLoanDataFromApiLoan(loan);
  if (!loanData) return null;

  const baseEvents = buildEventsFromApiPayments(payments);
  const baselineFull = calculateAmortization(loanData, baseEvents);

  const baselinePayoff = getEstimatedPayoffDate(baselineFull.schedule);
  const baselineInterest = getTotalInterest(baselineFull.paydown);
  const baselineMonths = baselinePayoff
    ? getMonthsBetweenDates(loanData.start_date, baselinePayoff)
    : 0;

  const baselineResult: SimulationResult = {
    paydown: baselineFull.paydown,
    schedule: baselineFull.schedule,
    payoffDate: baselinePayoff,
    totalInterest: baselineInterest,
    totalCost:
      (baselineFull.paydown.effective_principal ?? loanData.principal) +
      baselineInterest,
    monthsToPayoff: baselineMonths,
    monthsSaved: 0,
    interestSaved: 0,
  };

  if (extraMonthly <= 0) {
    return baselineResult;
  }

  const snapshot = extractLoanSnapshot(
    loan,
    payments,
    baselineFull.paydown,
    baselineFull.schedule
  );
  if (!snapshot) {
    return baselineResult;
  }

  const scenarioEvents = buildExtraScenarioEvents(
    snapshot,
    baselineFull.schedule,
    baseEvents,
    extraMonthly
  );

  try {
    const scenarioFull = calculateAmortization(loanData, scenarioEvents);

    const payoffDate = getEstimatedPayoffDate(scenarioFull.schedule);
    const scenarioInterest = getTotalInterest(scenarioFull.paydown);
    const baselineRemaining = countRemainingInstallments(baselineFull.schedule);
    const scenarioRemaining = countRemainingInstallments(
      scenarioFull.schedule
    );
    const monthsToPayoff = payoffDate
      ? getMonthsBetweenDates(loanData.start_date, payoffDate)
      : baselineMonths;

    return {
      paydown: scenarioFull.paydown,
      schedule: scenarioFull.schedule,
      payoffDate,
      totalInterest: scenarioInterest,
      totalCost:
        (scenarioFull.paydown.effective_principal ?? loanData.principal) +
        scenarioInterest,
      monthsToPayoff,
      monthsSaved: Math.max(0, baselineRemaining - scenarioRemaining),
      interestSaved: Math.max(0, baselineInterest - scenarioInterest),
    };
  } catch {
    return baselineResult;
  }
}

export interface ScenarioPreset {
  id: string;
  label: string;
  extraMonthly: number;
  result: SimulationResult | null;
}

export function buildScenarioPresets(
  loan: ApiLoan | null | undefined,
  payments: ApiPaymentItem[],
  baselineSchedule: PaymentLog[],
  customExtra: number,
  snapshot?: LoanPaymentSnapshot | null
): ScenarioPreset[] {
  const { presets } = getExtraPaymentSimulatorConfig(baselineSchedule, snapshot);

  const scenarioDefs = [
    { id: 'current', label: 'current', extraMonthly: 0 },
    ...presets
      .filter((p) => p.amount > 0)
      .map((p, i) => ({
        id: `plus${p.percentLabel?.replace(/\D/g, '') ?? i}`,
        label: p.percentLabel ?? `+${p.amount}`,
        extraMonthly: p.amount,
      })),
    { id: 'custom', label: 'custom', extraMonthly: customExtra },
  ];

  return scenarioDefs.map((p) => ({
    id: p.id,
    label: p.label,
    extraMonthly: p.extraMonthly,
    result: simulateExtraPayment(loan, payments, p.extraMonthly),
  }));
}
