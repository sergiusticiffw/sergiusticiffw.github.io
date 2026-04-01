'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  return (
    <button
      type="button"
      className="rounded-2xl bg-[var(--color-app-accent,#3b82f6)] px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          await fetch('/logout', { method: 'POST' })
        } finally {
          router.replace('/login?redirectTo=/')
          router.refresh()
        }
      }}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
