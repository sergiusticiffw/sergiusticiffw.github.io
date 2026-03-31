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
      redirect('/loans')
    }

    const { docs } = await payload.find({
      collection: 'loans',
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
    redirect('/admin/login?redirectTo=/loans')
  }

  return <LoansClient initialLoans={initialLoans} />
}

