import React from 'react'

import { AdminBar } from '@/payload/components/AdminBar'
import { Providers } from '@/providers'
import { draftMode } from 'next/headers'
import { AppShell } from '@/frontend/components/ui/AppShell'
import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import { isAdmin as isAdminUser } from '@/shared/utilities/payload/common'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  let isAdmin = false
  try {
    const { req } = await requireAuthedPayloadReqFromServer()
    isAdmin = isAdminUser((req as any)?.user)
  } catch {
    // not logged in - keep isAdmin false
  }

  return (
    <Providers>
      <AdminBar
        adminBarProps={{
          preview: isEnabled,
        }}
      />
      <AppShell isAdmin={isAdmin}>{children}</AppShell>
    </Providers>
  )
}
