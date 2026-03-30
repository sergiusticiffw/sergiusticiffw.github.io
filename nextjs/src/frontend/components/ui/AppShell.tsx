'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

function TabIcon({ name }: { name: 'loans' | 'admin' | 'profile' }) {
  if (name === 'loans') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 7h16M4 12h16M4 17h10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (name === 'admin') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3 20 7v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12.5 11 14l3.8-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-2xl transition',
        active ? 'text-white' : 'text-white/60 hover:text-white/80',
      ].join(' ')}
    >
      <div
        className={[
          'h-9 w-12 rounded-2xl flex items-center justify-center',
          active ? 'bg-white/10 border border-white/10' : 'bg-transparent',
        ].join(' ')}
      >
        {icon}
      </div>
      <div className="text-[11px] tracking-wide">{label}</div>
    </Link>
  )
}

export function AppShell({
  children,
  isAdmin,
}: {
  children: React.ReactNode
  isAdmin: boolean
}) {
  const pathname = usePathname() ?? '/'
  const isLoans = pathname === '/loans' || pathname.startsWith('/loans/')
  const isAdminArea = pathname.startsWith('/admin')
  const isProfile = pathname === '/profile'

  return (
    <div className="min-h-[100vh] bg-background text-foreground">
      <div className="pb-24">{children}</div>

      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className={isAdmin ? 'grid grid-cols-3' : 'grid grid-cols-2'}>
              <Tab href="/loans" label="Loans" icon={<TabIcon name="loans" />} active={isLoans} />
              {isAdmin ? (
                <Tab href="/admin" label="Admin" icon={<TabIcon name="admin" />} active={isAdminArea} />
              ) : null}
              <Tab href="/profile" label="Profile" icon={<TabIcon name="profile" />} active={isProfile} />
            </div>
          </div>
        </div>
      </nav>
    </div>
  )
}

