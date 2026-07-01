/**
 * Loan simulation utilities for extra-payment "what-if" scenarios.
 * Uses the existing Paydown engine — pure and memoizable.
 */
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
  calculatePaydownOnly,
  getNextRegularPayment,
} from './amortization';
import type { PaydownEvent, PaydownInit, PaydownResult, PaymentLog } from './paydown-node';

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
}

function roundNiceAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 10) return Math.max(1, Math.round(value));
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 1000) return Math.round(value / 10) * 10;
  if (value < 10000) return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}

/** Presets derived from the loan's next monthly installment (10%, 25%, 50%). */
export function getExtraPaymentSimulatorConfig(
  schedule: PaymentLog[]
): ExtraPaymentSimulatorConfig {
  const next = getNextRegularPayment(schedule);
  const baseInstallment = next?.installment ?? 0;

  if (baseInstallment <= 0) {
    return { baseInstallment: 0, presets: [{ amount: 0, percentLabel: null }], maxExtra: 0, step: 1 };
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

type PaymentMethod = 'equal_installment' | 'equal_principal';

function getPaymentMethod(loanData: PaydownInit): PaymentMethod {
  return loanData.recurring?.method === 'equal_principal'
    ? 'equal_principal'
    : 'equal_installment';
}

/** Recurring base used by Paydown: total installment or principal slice. */
function getRecurringBaseFromRow(
  row: PaymentLog,
  method: PaymentMethod
): number | null {
  if (method === 'equal_principal') {
    return parseScheduleInstallment(row.reduction);
  }
  return parseScheduleInstallment(row.installment);
}

function compareScheduleDates(a: string, b: string): number {
  const ams = parseScheduleDateToUtcMs(a) ?? 0;
  const bms = parseScheduleDateToUtcMs(b) ?? 0;
  return ams - bms;
}

function isOnOrAfterScheduleDate(
  date: string,
  firstUnpaidDate: string | null
): boolean {
  if (!firstUnpaidDate) return false;
  return compareScheduleDates(date, firstUnpaidDate) >= 0;
}

function findFirstUnpaidDate(schedule: PaymentLog[]): string | null {
  for (const row of schedule) {
    if (!isScheduleRow(row) || row.was_payed === true) continue;
    if (!row.date) continue;
    if (parseScheduleInstallment(row.installment) != null) return row.date;
  }
  return null;
}

/** Add extra to future fnra events already recorded in payment history. */
function applyExtraToBaseEvents(
  baseEvents: PaydownEvent[],
  extraMonthly: number,
  firstUnpaidDate: string | null
): PaydownEvent[] {
  if (!firstUnpaidDate || extraMonthly <= 0) return baseEvents;

  return baseEvents.map((event) => {
    if (!event.date || !isOnOrAfterScheduleDate(event.date, firstUnpaidDate)) {
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
 * When the projected recurring base changes (rate change, refinance, etc.),
 * bump recurring_amount so the extra persists after auto-recalculation.
 */
function buildRecurringBumpEvents(
  schedule: PaymentLog[],
  extraMonthly: number,
  method: PaymentMethod,
  firstUnpaidDate: string | null,
  fnraDates: Set<string>
): PaydownEvent[] {
  if (!firstUnpaidDate || extraMonthly <= 0) return [];

  const events: PaydownEvent[] = [];
  let lastBase: number | null = null;

  for (const row of schedule) {
    if (!isScheduleRow(row) || row.was_payed === true) continue;
    if (!row.date || !isOnOrAfterScheduleDate(row.date, firstUnpaidDate)) {
      continue;
    }

    const principal = parseSchedulePrincipal(row.principal);
    if (principal <= 0.01) break;

    const base = getRecurringBaseFromRow(row, method);
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
 * Build the full event list for an extra-monthly scenario:
 * - preserves payment history (rate / principal / fnra / actual payments)
 * - adds extra on top of existing fnra from the first unpaid date onward
 * - re-applies extra whenever the projected recurring base changes
 */
export function buildExtraScenarioEvents(
  loanData: PaydownInit,
  schedule: PaymentLog[],
  baseEvents: PaydownEvent[],
  extraMonthly: number
): PaydownEvent[] {
  if (extraMonthly <= 0) return baseEvents;

  const firstUnpaidDate = findFirstUnpaidDate(schedule);
  if (!firstUnpaidDate) return baseEvents;

  const method = getPaymentMethod(loanData);

  const fnraDates = new Set<string>();
  for (const event of baseEvents) {
    if (
      event.date &&
      Object.prototype.hasOwnProperty.call(event, 'recurring_amount') &&
      isOnOrAfterScheduleDate(event.date, firstUnpaidDate)
    ) {
      fnraDates.add(event.date);
    }
  }

  const modifiedBaseEvents = applyExtraToBaseEvents(
    baseEvents,
    extraMonthly,
    firstUnpaidDate
  );
  const bumpEvents = buildRecurringBumpEvents(
    schedule,
    extraMonthly,
    method,
    firstUnpaidDate,
    fnraDates
  );

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
  extraMonthly: number,
  baselineSchedule?: PaymentLog[]
): SimulationResult | null {
  const loanData = buildLoanDataFromApiLoan(loan);
  if (!loanData) return null;

  const baseEvents = buildEventsFromApiPayments(payments);

  const baselineFull =
    baselineSchedule != null
      ? {
          paydown: calculatePaydownOnly(loanData, baseEvents),
          schedule: baselineSchedule,
        }
      : calculateAmortization(loanData, baseEvents);

  const baselinePayoff = getEstimatedPayoffDate(baselineFull.schedule);
  const baselineInterest = getTotalInterest(baselineFull.paydown);
  const baselineMonths = baselinePayoff
    ? getMonthsBetweenDates(loanData.start_date, baselinePayoff)
    : 0;

  if (extraMonthly <= 0) {
    return {
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
  }

  const scenarioEvents = buildExtraScenarioEvents(
    loanData,
    baselineFull.schedule,
    baseEvents,
    extraMonthly
  );

  try {
    const { paydown, schedule } = calculateAmortization(
      loanData,
      scenarioEvents
    );

    const payoffDate = getEstimatedPayoffDate(schedule);
    const totalInterest = getTotalInterest(paydown);
    const baselineRemaining = countRemainingInstallments(baselineFull.schedule);
    const scenarioRemaining = countRemainingInstallments(schedule);
    const monthsToPayoff = payoffDate
      ? getMonthsBetweenDates(loanData.start_date, payoffDate)
      : baselineMonths;

    return {
      paydown,
      schedule,
      payoffDate,
      totalInterest,
      totalCost:
        (paydown.effective_principal ?? loanData.principal) + totalInterest,
      monthsToPayoff,
      monthsSaved: Math.max(0, baselineRemaining - scenarioRemaining),
      interestSaved: Math.max(0, baselineInterest - totalInterest),
    };
  } catch {
    // Simulation failed (e.g. invalid recurring bump) — return baseline unchanged
    return {
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
  customExtra: number
): ScenarioPreset[] {
  const { presets } = getExtraPaymentSimulatorConfig(baselineSchedule);

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
    result: simulateExtraPayment(
      loan,
      payments,
      p.extraMonthly,
      baselineSchedule
    ),
  }));
}
