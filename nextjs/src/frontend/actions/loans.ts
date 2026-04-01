'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import type { ApiLoan, ApiPaymentItem } from '@/shared/types/loans'
import { mapPayloadLoanToApiLoan, mapPayloadPaymentToApiPaymentItem } from '@/frontend/server/loans/mappers'

function getOwnerId(owner: unknown): string | null {
  if (!owner) return null
  if (typeof owner === 'string' || typeof owner === 'number') return String(owner)
  if (typeof owner === 'object' && 'id' in owner) {
    const id = (owner as any).id
    return id ? String(id) : null
  }
  return null
}

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
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

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
      field_owner: userId,
    },
    overrideAccess: false,
    req: req as any,
  })

  // Ensure server components refresh.
  const apiLoan = mapPayloadLoanToApiLoan(created)
  void apiLoan
  revalidatePath('/')
}

export async function updateLoanAction(input: LoanUpdateInput): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const loanDoc = await payload.findByID({
    collection: 'loans',
    id: loanIdNum,
    overrideAccess: false,
    req: req as any,
  })
  const loanOwnerId = getOwnerId(loanDoc?.field_owner)
  if (!loanDoc || loanOwnerId !== String(userId)) {
    throw new Error('Forbidden')
  }

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
    overrideAccess: false,
    req: req as any,
  })

  revalidatePath('/')
  revalidatePath(`/loans/${input.loanId}`)
}

export async function deleteLoanAction(loanId: string): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

  const loanIdNum = Number(loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const loanDoc = await payload.findByID({
    collection: 'loans',
    id: loanIdNum,
    overrideAccess: false,
    req: req as any,
  })
  const loanOwnerId = getOwnerId(loanDoc?.field_owner)
  if (!loanDoc || loanOwnerId !== String(userId)) {
    throw new Error('Forbidden')
  }

  await payload.delete({
    collection: 'loans',
    id: loanIdNum,
    overrideAccess: false,
    req: req as any,
  })

  revalidatePath('/')
}

export async function createPaymentAction(input: PaymentCreateInput): Promise<ApiPaymentItem> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const loanDoc = await payload.findByID({
    collection: 'loans',
    id: loanIdNum,
    overrideAccess: false,
    req: req as any,
  })
  const loanOwnerId = getOwnerId(loanDoc?.field_owner)
  if (!loanDoc || loanOwnerId !== String(userId)) {
    throw new Error('Forbidden')
  }

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
      field_owner: userId,
    },
    overrideAccess: false,
    req: req as any,
  })

  return mapPayloadPaymentToApiPaymentItem(created)
}

export async function updatePaymentAction(input: PaymentUpdateInput): Promise<ApiPaymentItem> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const paymentIdNum = Number(input.paymentId)
  if (!Number.isFinite(paymentIdNum)) throw new Error('Invalid paymentId')

  const paymentDoc = await payload.findByID({
    collection: 'payments',
    id: paymentIdNum,
    overrideAccess: false,
    req: req as any,
  })
  const paymentOwnerId = getOwnerId(paymentDoc?.field_owner)
  if (!paymentDoc || paymentOwnerId !== String(userId)) {
    throw new Error('Forbidden')
  }

  const updated = await payload.update({
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
    overrideAccess: false,
    req: req as any,
  })

  return mapPayloadPaymentToApiPaymentItem(updated)
}

export async function deletePaymentAction(input: {
  paymentId: string
  loanId: string
}): Promise<void> {
  const { payload, req } = await requireAuthedPayloadReqFromServer()
  const userId = (req.user as any)?.id
  if (!userId) throw new Error('Unauthorized')

  const loanIdNum = Number(input.loanId)
  if (!Number.isFinite(loanIdNum)) throw new Error('Invalid loanId')

  const paymentIdNum = Number(input.paymentId)
  if (!Number.isFinite(paymentIdNum)) throw new Error('Invalid paymentId')

  const paymentDoc = await payload.findByID({
    collection: 'payments',
    id: paymentIdNum,
    overrideAccess: false,
    req: req as any,
  })
  const paymentOwnerId = getOwnerId(paymentDoc?.field_owner)
  if (!paymentDoc || paymentOwnerId !== String(userId)) {
    throw new Error('Forbidden')
  }

  await payload.delete({
    collection: 'payments',
    id: paymentIdNum,
    overrideAccess: false,
    req: req as any,
  })
}
