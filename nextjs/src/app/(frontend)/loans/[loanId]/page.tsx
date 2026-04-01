import { redirect } from 'next/navigation'

import LoanDetailClient from '@/frontend/components/loans/Loan/LoanDetailClient'

import type { ApiLoan, ApiPaymentItem } from '@/shared/types/loans'
import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import { mapPayloadLoanToApiLoan, mapPayloadPaymentToApiPaymentItem } from '@/frontend/server/loans/mappers'

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{
    loanId: string
  }>
}) {
  const { loanId } = await params

  const loanIdNum = Number(loanId)
  if (!Number.isFinite(loanIdNum)) {
    return <div className="max-w-5xl mx-auto px-4 py-8 text-white/70">Invalid loan id.</div>
  }

  let initialLoan: ApiLoan | null = null
  let initialPayments: ApiPaymentItem[] = []

  try {
    const { payload, req } = await requireAuthedPayloadReqFromServer()
    const userId = (req.user as any)?.id
    if (!userId) {
      redirect('/')
    }

    const loanDoc = await payload.findByID({
      collection: 'loans',
      id: loanIdNum,
      depth: 0,
      overrideAccess: false,
      req: req as any,
    })

    const loanOwnerId =
      loanDoc?.field_owner && typeof loanDoc.field_owner === 'object' && 'id' in loanDoc.field_owner
        ? String((loanDoc.field_owner as any).id)
        : loanDoc?.field_owner

    if (!loanDoc || String(loanOwnerId) !== String(userId)) {
      redirect('/')
    }

    initialLoan = mapPayloadLoanToApiLoan(loanDoc)

    const { docs } = await payload.find({
      collection: 'payments',
      depth: 0,
      select: {
        id: true,
        title: true,
        field_date: true,
        field_rate: true,
        field_pay_installment: true,
        field_pay_single_fee: true,
        field_new_recurring_amount: true,
        field_new_principal: true,
        field_payment_method: true,
        field_is_simulated_payment: true,
        field_loan_reference: true,
      },
      where: {
        and: [
          {
            field_owner: {
              equals: userId,
            },
          },
          {
            field_loan_reference: {
              equals: loanIdNum,
            },
          },
        ],
      },
      limit: 1000,
      sort: '-createdAt',
      overrideAccess: false,
      req: req as any,
    })

    initialPayments = docs.map(mapPayloadPaymentToApiPaymentItem)
  } catch {
    redirect(`/login?redirectTo=${encodeURIComponent(`/loans/${loanId}`)}`)
  }

  return <LoanDetailClient loanId={loanId} initialLoan={initialLoan} initialPayments={initialPayments} />
}
