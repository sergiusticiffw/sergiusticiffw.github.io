/**
 * Pure amortization logic: build inputs and run Paydown once.
 * Deterministic and memoizable by callers (useAmortization hook).
 */
import Paydown from './paydown-node';
import type {
  PaydownInit,
  PaydownEvent,
  PaydownResult,
  PaymentLog,
} from './paydown-node';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import { transformDateFormat, transformToNumber } from '@shared/utils/utils';
import { isEarlyPaymentByTitle } from './paymentClassification';

export type { PaydownResult, PaymentLog, PaydownInit, PaydownEvent };

/** Build PaydownInit from API loan. Pure. */
export function buildLoanDataFromApiLoan(
  loan: ApiLoan | null | undefined
): PaydownInit | null {
  if (!loan?.sdt || !loan?.edt) return null;
  const start_date = transformDateFormat(loan.sdt);
  const end_date = transformDateFormat(loan.edt);
  const principal = transformToNumber(loan.fp ?? 0);
  const rate = transformToNumber(loan.fr ?? 0);
  const base: PaydownInit = {
    start_date,
    end_date,
    principal,
    rate,
    day_count_method: 'act/365',
  };
  if (loan.fif != null && loan.fif !== '') {
    base.initial_fee = transformToNumber(loan.fif);
  }
  if (loan.pdt && loan.frpd != null) {
    base.recurring = {
      first_payment_date: transformDateFormat(loan.pdt),
      payment_day: transformToNumber(loan.frpd),
      method:
        loan.fpm === 'equal_principal' ? 'equal_principal' : 'equal_installment',
    };
  }
  return base;
}

/** Whether a payment event is early/advance (by title). Pure. */
export function isEarlyPayment(
  event: PaydownEvent & { title?: string }
): boolean {
  return Boolean(event.isEarlyPayment) || isEarlyPaymentByTitle(event.title);
}

/** Whether an API payment item is early (by title). Pure. */
export function isEarlyPaymentFromApiItem(item: ApiPaymentItem): boolean {
  return isEarlyPaymentByTitle(item.title);
}

/** Build PaydownEvent[] from API payment items. Pure. */
export function buildEventsFromApiPayments(
  payments: ApiPaymentItem[] | null | undefined
): PaydownEvent[] {
  if (!payments?.length) return [];

  const sorted = [...payments].sort((a, b) => {
    const dateA = new Date(a.fdt || 0).getTime();
    const dateB = new Date(b.fdt || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    const earlyA = isEarlyPaymentFromApiItem(a) ? 1 : 0;
    const earlyB = isEarlyPaymentFromApiItem(b) ? 1 : 0;
    if (earlyA !== earlyB) return earlyA - earlyB;
    const crA = a.cr ?? dateA;
    const crB = b.cr ?? dateB;
    return crA - crB;
  });

  return sorted.map((item, index) => {
    const isSimulatedPayment = Number(item.fisp ?? 0) !== 0;
    const isEarly = isEarlyPaymentFromApiItem(item);
    const event: PaydownEvent = {
      date: transformDateFormat(item.fdt ?? ''),
      isSimulatedPayment,
      isEarlyPayment: isEarly || undefined,
      event_order: index,
    };
    if (item.fr != null && item.fr !== '')
      event.rate = transformToNumber(item.fr);
    if (item.fpi != null && item.fpi !== '')
      event.pay_installment = transformToNumber(item.fpi);
    if (item.fpsf != null && item.fpsf !== '')
      event.pay_single_fee = transformToNumber(item.fpsf);
    if (item.fnra != null && item.fnra !== '')
      event.recurring_amount = transformToNumber(item.fnra);
    if (item.fnp != null && item.fnp !== '')
      event.new_principal = transformToNumber(item.fnp);
    if (item.fpm === 'equal_installment' || item.fpm === 'equal_principal') {
      event.payment_method = item.fpm;
    }
    if (item.title != null)
      (event as PaydownEvent & { title?: string }).title = item.title;

    // If the API provides a simulated payment with a date but without an explicit installment amount,
    // treat it as a scheduled recurring payment so it appears in the schedule/graph and affects projections.
    if (isSimulatedPayment && event.pay_installment == null) {
      event.pay_recurring = true;
    }
    return event;
  });
}

/**
 * Run Paydown once. Pure and deterministic for given (loanData, events).
 * Returns schedule in the same order as Paydown (mutates then returns the array).
 */
export function calculateAmortization(
  loanData: PaydownInit,
  events: PaydownEvent[]
): { paydown: PaydownResult; schedule: PaymentLog[] } {
  const schedule: PaymentLog[] = [];
  const calculator = Paydown();
  const paydown = calculator.calculate(loanData, events, schedule);
  return { paydown, schedule };
}

/**
 * Run Paydown once, but without building the schedule (much faster for list views).
 */
export function calculatePaydownOnly(
  loanData: PaydownInit,
  events: PaydownEvent[]
): PaydownResult {
  const calculator = Paydown();
  return calculator.calculate(loanData, events);
}

/**
 * Interest saved by extra/early payments vs. the same loan with only regular payments.
 * Returns 0 when there is no meaningful savings.
 */
export function calculateInterestSavings(
  loan: ApiLoan | null | undefined,
  payments: ApiPaymentItem[]
): number {
  if (!loan?.sdt || !loan?.edt) return 0;

  const hasExtra =
    payments.some(isEarlyPaymentFromApiItem) ||
    payments.some((item) => Number(item.fisp ?? 0) !== 0);
  if (!hasExtra) return 0;

  const loanData = buildLoanDataFromApiLoan(loan);
  if (!loanData) return 0;

  const scheduledPayments = payments.filter(
    (item) =>
      !isEarlyPaymentFromApiItem(item) && Number(item.fisp ?? 0) === 0
  );

  const withExtra = calculatePaydownOnly(
    loanData,
    buildEventsFromApiPayments(payments)
  );
  const withoutExtra = calculatePaydownOnly(
    loanData,
    buildEventsFromApiPayments(scheduledPayments)
  );

  const interestWithExtra = withExtra.sum_of_interests ?? 0;
  const interestWithoutExtra = withoutExtra.sum_of_interests ?? 0;
  let savings = Math.max(0, interestWithoutExtra - interestWithExtra);

  if (savings > interestWithExtra * 10) {
    savings = 0;
  }

  return savings;
}

export const REGULAR_PAYMENT_TITLE = 'Regular' as const;

export interface NextRegularPayment {
  title: typeof REGULAR_PAYMENT_TITLE;
  date: string;
  installment: number;
}

/** Convert paydown schedule date (DD.MM.YYYY) to HTML date input format (YYYY-MM-DD). */
export function scheduleDateToFormDate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('.');
  if (parts.length !== 3) return ddmmyyyy;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseScheduleInstallment(
  value: number | string | undefined
): number | null {
  if (value == null || value === '-' || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? roundToCents(num) : null;
}

/** First unpaid schedule row with a valid installment — the next regular payment. */
export function getNextRegularPayment(
  schedule: PaymentLog[]
): NextRegularPayment | null {
  for (const row of schedule) {
    if ('type' in row && (row as { type?: string }).type === 'annual_summary') {
      continue;
    }
    if (row.was_payed === true) continue;
    const installment = parseScheduleInstallment(row.installment);
    if (installment == null) continue;
    if (!row.date || typeof row.date !== 'string') continue;
    return {
      title: REGULAR_PAYMENT_TITLE,
      date: row.date,
      installment,
    };
  }
  return null;
}
