import { redirect } from 'next/navigation'

import LoansClient from '@/frontend/components/loans/Loans/LoansClient'

import type { ApiLoan } from '@/shared/types/loans'
import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import { mapPayloadLoanToApiLoan } from '@/frontend/server/loans/mappers'

export default async function LoansPage() {
  let initialLoans: ApiLoan[] = []
  try {
    const { payload, req } = await requireAuthedPayloadReqFromServer()
    const userId = (req.user as any)?.id
    if (!userId) {
      redirect('/')
    }

    const { docs } = await payload.find({
      collection: 'loans',
      depth: 0,
      select: {
        id: true,
        title: true,
        field_principal: true,
        field_start_date: true,
        field_end_date: true,
        field_rate: true,
        field_initial_fee: true,
        field_rec_first_payment_date: true,
        field_recurring_payment_day: true,
        field_payment_method: true,
        field_loan_status: true,
      },
      where: {
        field_owner: {
          equals: userId,
        },
      },
      limit: 1000,
      sort: '-createdAt',
      overrideAccess: false,
      req: req as any,
    })

    initialLoans = docs.map(mapPayloadLoanToApiLoan)
  } catch (e) {
    redirect('/login?redirectTo=/')
  }

  return <LoansClient initialLoans={initialLoans} />
}
