import type { ApiLoan, ApiPaymentItem } from '../types'

import { transformToNumber } from '../date'

const toISODate = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return undefined
}

const toNumber = (value: unknown): number => transformToNumber((value ?? 0) as string | number)

export function mapPayloadLoanToApiLoan(doc: any): ApiLoan {
  return {
    id: String(doc.id),
    title: doc.title ?? '',
    field_principal: toNumber(doc.field_principal),
    field_start_date: toISODate(doc.field_start_date) ?? '',
    field_end_date: toISODate(doc.field_end_date) ?? '',
    field_rate: toNumber(doc.field_rate),
    field_initial_fee: doc.field_initial_fee ?? undefined,
    field_rec_first_payment_date: doc.field_rec_first_payment_date ?? undefined,
    field_recurring_payment_day: doc.field_recurring_payment_day ?? undefined,
    field_payment_method: doc.field_payment_method as ApiLoan['field_payment_method'],
    field_loan_status: doc.field_loan_status as ApiLoan['field_loan_status'],
  }
}

export function mapPayloadPaymentToApiPaymentItem(doc: any): ApiPaymentItem {
  return {
    id: String(doc.id),
    title: doc.title ?? '',
    field_date: toISODate(doc.field_date) ?? '',
    field_rate: doc.field_rate ?? undefined,
    field_pay_installment: doc.field_pay_installment ?? undefined,
    field_pay_single_fee: doc.field_pay_single_fee ?? undefined,
    field_new_recurring_amount: doc.field_new_recurring_amount ?? undefined,
    field_new_principal: doc.field_new_principal ?? undefined,
    field_payment_method: doc.field_payment_method ?? undefined,
    field_is_simulated_payment: Boolean(doc.field_is_simulated_payment),
    field_loan_reference: doc.field_loan_reference,
  }
}

