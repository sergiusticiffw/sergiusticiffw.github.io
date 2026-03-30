import { redirect } from 'next/navigation'

import LoanDetailClient from '@/components/loans/components/Loan/LoanDetailClient'

import type { ApiLoan, ApiPaymentItem } from '@/components/loans/types'
import { requireAuthedPayloadReqFromServer } from '@/utilities/loans/server/payloadAuth'
import { mapPayloadLoanToApiLoan, mapPayloadPaymentToApiPaymentItem } from '@/utilities/loans/server/mappers'

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

    const loanDoc = await payload.findByID({
      collection: 'loans',
      id: loanIdNum,
      req: req as any,
    })

    initialLoan = loanDoc ? mapPayloadLoanToApiLoan(loanDoc) : null

    const { docs } = await payload.find({
      collection: 'payments',
      where: {
        field_loan_reference: {
          equals: loanIdNum,
        },
      },
      limit: 1000,
      sort: '-createdAt',
      req: req as any,
    })

    initialPayments = docs.map(mapPayloadPaymentToApiPaymentItem)
  } catch {
    redirect(`/admin/login?redirectTo=${encodeURIComponent(`/loans/${loanId}`)}`)
  }

  return <LoanDetailClient loanId={loanId} initialLoan={initialLoan} initialPayments={initialPayments} />
}

