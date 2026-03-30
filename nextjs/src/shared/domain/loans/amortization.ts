/**
 * Pure amortization logic: build inputs and run Paydown once.
 * Deterministic and memoizable by callers.
 */
import Paydown from './paydown-node'
import type {
  PaydownInit,
  PaydownEvent,
  PaydownResult,
  PaymentLog,
} from './paydown-node'

import type { ApiLoan, ApiPaymentItem } from './types'

import { transformDateFormat, transformToNumber } from './date'

export type { PaydownResult, PaymentLog, PaydownInit, PaydownEvent }

/** Build PaydownInit from API loan. Pure. */
export function buildLoanDataFromApiLoan(
  loan: ApiLoan | null | undefined,
): PaydownInit | null {
  if (!loan?.field_start_date || !loan?.field_end_date) return null

  const start_date = transformDateFormat(loan.field_start_date)
  const end_date = transformDateFormat(loan.field_end_date)
  const principal = transformToNumber(loan.field_principal ?? 0)
  const rate = transformToNumber(loan.field_rate ?? 0)

  const base: PaydownInit = {
    start_date,
    end_date,
    principal,
    rate,
    day_count_method: 'act/365',
  }

  if (loan.field_initial_fee != null) {
    base.initial_fee = transformToNumber(loan.field_initial_fee)
  }

  if (loan.field_rec_first_payment_date && loan.field_recurring_payment_day != null) {
    base.recurring = {
      first_payment_date: transformDateFormat(loan.field_rec_first_payment_date),
      payment_day: transformToNumber(loan.field_recurring_payment_day),
      method: loan.field_payment_method === 'equal_principal' ? 'equal_principal' : 'equal_installment',
    }
  }

  return base
}

/** Build PaydownEvent[] from API payment items. Pure. */
export function buildEventsFromApiPayments(
  payments: ApiPaymentItem[] | null | undefined,
): PaydownEvent[] {
  if (!payments?.length) return []

  return payments.map((item) => {
    const event: PaydownEvent = {
      date: transformDateFormat(item.field_date ?? ''),
      isSimulatedPayment: item.field_is_simulated_payment,
    }

    if (item.field_rate != null) event.rate = transformToNumber(item.field_rate)
    if (item.field_pay_installment != null)
      event.pay_installment = transformToNumber(item.field_pay_installment)
    if (item.field_pay_single_fee != null)
      event.pay_single_fee = transformToNumber(item.field_pay_single_fee)
    if (item.field_new_recurring_amount != null)
      event.recurring_amount = transformToNumber(item.field_new_recurring_amount)
    if (item.field_new_principal != null) event.new_principal = transformToNumber(item.field_new_principal)

    if (item.field_payment_method === 'equal_installment' || item.field_payment_method === 'equal_principal') {
      event.payment_method = item.field_payment_method
    }

    if (item.title != null) {
      ;(event as PaydownEvent & { title?: string }).title = item.title
    }

    return event
  })
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
]

/** Whether an API payment item is early (by title). Pure. */
export function isEarlyPaymentFromApiItem(item: ApiPaymentItem): boolean {
  const title = (item.title ?? '').toString().toLowerCase()
  return EARLY_TITLE_KEYS.some((k) => title.includes(k))
}

/** Run Paydown once, with optional schedule creation. */
export function calculatePaydownOnly(
  loanData: PaydownInit,
  events: PaydownEvent[],
): PaydownResult {
  const calculator = Paydown()
  return calculator.calculate(loanData, events)
}

/** Run Paydown once and build schedule array. */
export function calculateAmortization(
  loanData: PaydownInit,
  events: PaydownEvent[],
): { paydown: PaydownResult; schedule: PaymentLog[] } {
  const schedule: PaymentLog[] = []
  const calculator = Paydown()
  const paydown = calculator.calculate(loanData, events, schedule)
  return { paydown, schedule }
}

