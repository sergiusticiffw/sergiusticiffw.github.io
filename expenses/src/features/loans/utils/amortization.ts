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
    };
  }
  return base;
}

/** Build PaydownEvent[] from API payment items. Pure. */
export function buildEventsFromApiPayments(
  payments: ApiPaymentItem[] | null | undefined
): PaydownEvent[] {
  if (!payments?.length) return [];
  return payments.map((item) => {
    const event: PaydownEvent = {
      date: transformDateFormat(item.fdt ?? ''),
      isSimulatedPayment: Number(item.fisp ?? 0) !== 0,
    };
    if (item.fr != null && item.fr !== '')
      event.rate = transformToNumber(item.fr);
    if (item.fpi != null && item.fpi !== '')
      event.pay_installment = transformToNumber(item.fpi);
    if (item.fpsf != null && item.fpsf !== '')
      event.pay_single_fee = transformToNumber(item.fpsf);
    if (item.fnra != null && item.fnra !== '')
      event.recurring_amount = transformToNumber(item.fnra);
    if (item.title != null)
      (event as PaydownEvent & { title?: string }).title = item.title;
    return event;
  });
}

const EARLY_TITLE_KEYS = [
  'anticipat',
  'avans',
  'înainte',
  'inainte',
  'prematur',
  'extra',
  'suplimentar',
  'early',
  'advance',
  'premature',
  'additional',
];

/** Whether a payment event is early/advance (by title). Pure. */
export function isEarlyPayment(
  event: PaydownEvent & { title?: string }
): boolean {
  const title = (event.title ?? '').toLowerCase();
  return EARLY_TITLE_KEYS.some((k) => title.includes(k));
}

/** Whether an API payment item is early (by title). Pure. */
export function isEarlyPaymentFromApiItem(item: ApiPaymentItem): boolean {
  const title = (item.title ?? '').toString().toLowerCase();
  return EARLY_TITLE_KEYS.some((k) => title.includes(k));
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
