'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import type { ApiLoan, ApiPaymentItem } from '@/shared/types/loans'
import { mapPayloadLoanToApiLoan, mapPayloadPaymentToApiPaymentItem } from '@/frontend/server/loans/mappers'

type LoanCreateInput = {
  title: string
  field_principal: number
  field_start_date: string
  field_end_date: string
  field_rate: number
  field_initial_fee?: number
  field_rec_first_payment_date?: string
  field_recurring_payment_day?: number
  field_payment_method: ApiLoan['field_payment_method']
  field_loan_status: ApiLoan['field_loan_status']
}

type LoanUpdateInput = LoanCreateInput & { loanId: string }

type PaymentCreateInput = {
  loanId: string
  title: string
  field_date: string
  field_rate?: number
  field_pay_installment?: number
  field_pay_single_fee?: number
  field_new_recurring_amount?: number
  field_new_principal?: number
  field_payment_method?: ApiPaymentItem['field_payment_method']
  field_is_simulated_payment: boolean
}

type PaymentUpdateInput = PaymentCreateInput & { paymentId: string }

export async function createLoanAction(input: LoanCreateInput): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const created = await payload.create({
    collection: 'loans',
    data: {
      title: input.title,
      field_principal: input.field_principal,
      field_start_date: input.field_start_date,
      field_end_date: input.field_end_date,
      field_rate: input.field_rate,
      field_initial_fee: input.field_initial_fee ?? null,
      field_rec_first_payment_date: input.field_rec_first_payment_date ?? null,
      field_recurring_payment_day: input.field_recurring_payment_day ?? null,
      field_payment_method: input.field_payment_method,
      field_loan_status: input.field_loan_status,
    },
    req: req as any,
  })

  // Ensure server components refresh.
  const apiLoan = mapPayloadLoanToApiLoan(created)
  void apiLoan
  revalidatePath('/loans')
}

export async function updateLoanAction(input: LoanUpdateInput): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  await payload.update({
    collection: 'loans',
    id: loanIdNum,
    data: {
      title: input.title,
      field_principal: input.field_principal,
      field_start_date: input.field_start_date,
      field_end_date: input.field_end_date,
      field_rate: input.field_rate,
      field_initial_fee: input.field_initial_fee ?? null,
      field_rec_first_payment_date: input.field_rec_first_payment_date ?? null,
      field_recurring_payment_day: input.field_recurring_payment_day ?? null,
      field_payment_method: input.field_payment_method,
      field_loan_status: input.field_loan_status,
    },
    req: req as any,
  })

  revalidatePath('/loans')
  revalidatePath(`/loans/${input.loanId}`)
}

export async function deleteLoanAction(loanId: string): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const loanIdNum = Number(loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  await payload.delete({
    collection: 'loans',
    id: loanIdNum,
    req: req as any,
  })

  revalidatePath('/loans')
}

export async function createPaymentAction(input: PaymentCreateInput): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const created = await payload.create({
    collection: 'payments',
    data: {
      title: input.title,
      field_date: input.field_date,
      field_rate: input.field_rate ?? null,
      field_pay_installment: input.field_pay_installment ?? null,
      field_pay_single_fee: input.field_pay_single_fee ?? null,
      field_new_recurring_amount: input.field_new_recurring_amount ?? null,
      field_new_principal: input.field_new_principal ?? null,
      ...(input.field_payment_method !== undefined
        ? { field_payment_method: input.field_payment_method }
        : {}),
      field_is_simulated_payment: input.field_is_simulated_payment,
      field_loan_reference: loanIdNum,
    },
    req: req as any,
  })

  const apiPayment = mapPayloadPaymentToApiPaymentItem(created)
  void apiPayment

  revalidatePath(`/loans/${input.loanId}`)
}

export async function updatePaymentAction(input: PaymentUpdateInput): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const paymentIdNum = Number(input.paymentId)
  if (!Number.isFinite(paymentIdNum)) throw new Error('Invalid paymentId')

  await payload.update({
    collection: 'payments',
    id: paymentIdNum,
    data: {
      title: input.title,
      field_date: input.field_date,
      field_rate: input.field_rate ?? null,
      field_pay_installment: input.field_pay_installment ?? null,
      field_pay_single_fee: input.field_pay_single_fee ?? null,
      field_new_recurring_amount: input.field_new_recurring_amount ?? null,
      field_new_principal: input.field_new_principal ?? null,
      ...(input.field_payment_method !== undefined
        ? { field_payment_method: input.field_payment_method }
        : {}),
      field_is_simulated_payment: input.field_is_simulated_payment,
      field_loan_reference: loanIdNum,
    },
    req: req as any,
  })

  revalidatePath(`/loans/${input.loanId}`)
}

export async function deletePaymentAction(input: {
  paymentId: string
  loanId: string
}): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()

  const paymentIdNum = Number(input.paymentId)
  if (!Number.isFinite(paymentIdNum)) throw new Error('Invalid paymentId')

  await payload.delete({
    collection: 'payments',
    id: paymentIdNum,
    req: req as any,
  })

  revalidatePath(`/loans/${input.loanId}`)
}
