import { redirect } from 'next/navigation'

import LoansClient from '@/components/loans/components/Loans/LoansClient'

import type { ApiLoan } from '@/components/loans/types'
import { requireAuthedPayloadReqFromServer } from '@/utilities/loans/server/payloadAuth'
import { mapPayloadLoanToApiLoan } from '@/utilities/loans/server/mappers'

export default async function LoansPage() {
  let initialLoans: ApiLoan[] = []
  try {
    const { payload, req } = await requireAuthedPayloadReqFromServer()

    const { docs } = await payload.find({
      collection: 'loans',
      limit: 1000,
      sort: '-createdAt',
      req: req as any,
    })

    initialLoans = docs.map(mapPayloadLoanToApiLoan)
  } catch (e) {
    redirect('/admin/login?redirectTo=/loans')
  }

  return <LoansClient initialLoans={initialLoans} />
}

