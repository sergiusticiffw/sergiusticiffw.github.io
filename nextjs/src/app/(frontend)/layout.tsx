import React from 'react'

import { Providers } from '@/providers'
import { AppShell } from '@/frontend/components/ui/AppShell'
import { cookies } from 'next/headers'

function getJwtPayload(token: string): any | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payloadPart = parts[1]
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

function tokenHasAdminRole(token: string | undefined): boolean {
  if (!token) return false
  const payload = getJwtPayload(token)
  const roles = payload?.roles
  return Array.isArray(roles) && roles.includes('admin')
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  const isAdmin = tokenHasAdminRole(token)

  return (
    <Providers>
      <AppShell isAdmin={isAdmin}>{children}</AppShell>
    </Providers>
  )
}
