/**
 * Loan state snapshot after the last actual payment — used for forward simulations.
 */
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import type { PaydownResult, PaymentLog } from './paydown-node';
import { getNextRegularPayment } from './amortization';
import { transformToNumber } from '@shared/utils/utils';

export type PaymentMethod = 'equal_installment' | 'equal_principal';

export interface LoanPaymentSnapshot {
  nextPaymentDate: string;
  nextInstallment: number;
  /** Paydown recurring base: total installment or principal slice. */
  recurringBase: number;
  paymentMethod: PaymentMethod;
  remainingPrincipal: number;
  currentRate: number;
  latestPaymentDate: string | null;
}

function parseScheduleDateToUtcMs(date: string): number | null {
  const parts = (date ?? '').split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function parseScheduleInstallment(
  value: number | string | undefined
): number | null {
  if (value == null || value === '-' || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function isScheduleRow(row: PaymentLog | { type?: string }): row is PaymentLog {
  return !('type' in row && (row as { type?: string }).type === 'annual_summary');
}

function parseRateFromRow(row: PaymentLog): number | null {
  const rateRaw = row.rate;
  if (rateRaw === '-' || rateRaw == null || rateRaw === '') return null;
  const r = typeof rateRaw === 'number' ? rateRaw : Number(rateRaw);
  return Number.isFinite(r) && r >= 0 ? r : null;
}

/** Latest effective rate in the schedule on or before asOfDate (defaults to today). */
export function getEffectiveRateFromSchedule(
  schedule: PaymentLog[],
  asOfDate?: Date
): number | null {
  if (!schedule.length) return null;

  const todayUtc = asOfDate
    ? Date.UTC(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate())
    : Date.UTC(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      );

  for (let i = schedule.length - 1; i >= 0; i--) {
    const row = schedule[i];
    if (!isScheduleRow(row) || !row.date) continue;
    const rowUtc = parseScheduleDateToUtcMs(row.date);
    if (rowUtc == null || rowUtc > todayUtc) continue;
    const r = parseRateFromRow(row);
    if (r != null) return r;
  }

  for (let i = schedule.length - 1; i >= 0; i--) {
    const row = schedule[i];
    if (!isScheduleRow(row)) continue;
    const r = parseRateFromRow(row);
    if (r != null) return r;
  }

  return null;
}

/** Repayment method from the last real (non-simulated) payment, else loan default. */
export function getPaymentMethodAtLastPayment(
  payments: ApiPaymentItem[],
  loan: ApiLoan | null | undefined
): PaymentMethod {
  const realPayments = [...payments]
    .filter((p) => Number(p.fisp ?? 0) === 0)
    .sort((a, b) => {
      const dateA = new Date(a.fdt || 0).getTime();
      const dateB = new Date(b.fdt || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      const crA = (a.cr as number | undefined) ?? dateA;
      const crB = (b.cr as number | undefined) ?? dateB;
      return crB - crA;
    });

  for (const p of realPayments) {
    if (p.fpm === 'equal_principal') return 'equal_principal';
    if (p.fpm === 'equal_installment') return 'equal_installment';
  }

  return loan?.fpm === 'equal_principal' ? 'equal_principal' : 'equal_installment';
}

/** Paydown recurring base from a schedule row (method-aware). */
export function getRecurringBaseFromRow(
  row: PaymentLog,
  method: PaymentMethod
): number | null {
  if (method === 'equal_principal') {
    return parseScheduleInstallment(row.reduction);
  }
  return parseScheduleInstallment(row.installment);
}

function findScheduleRowAtDate(
  schedule: PaymentLog[],
  date: string
): PaymentLog | null {
  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (row.date === date) return row;
  }
  return null;
}

/**
 * Extract loan state after all recorded payments — anchor for extra-payment simulation.
 */
export function extractLoanSnapshot(
  loan: ApiLoan | null | undefined,
  payments: ApiPaymentItem[],
  paydown: PaydownResult,
  schedule: PaymentLog[]
): LoanPaymentSnapshot | null {
  const next = getNextRegularPayment(schedule);
  if (!next?.date) return null;

  const nextRow = findScheduleRowAtDate(schedule, next.date);
  if (!nextRow) return null;

  const paymentMethod = getPaymentMethodAtLastPayment(payments, loan);
  const recurringBase = getRecurringBaseFromRow(nextRow, paymentMethod);
  if (recurringBase == null) return null;

  const scheduleRate = getEffectiveRateFromSchedule(schedule);
  const currentRate =
    scheduleRate ??
    transformToNumber(loan?.fr ?? 0);

  const remainingPrincipal =
    paydown.remaining_principal_after_paid ?? paydown.remaining_principal ?? 0;

  const latestPaymentDate =
    paydown.latest_payment_date && paydown.latest_payment_date !== 'N/A'
      ? paydown.latest_payment_date
      : null;

  return {
    nextPaymentDate: next.date,
    nextInstallment: next.installment,
    recurringBase,
    paymentMethod,
    remainingPrincipal,
    currentRate,
    latestPaymentDate,
  };
}
