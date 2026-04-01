import { redirect } from 'next/navigation'

import { requireAuthedPayloadReqFromServer } from '@/frontend/server/loans/payloadAuth'
import { isAdmin } from '@/shared/utilities/payload/common'

import { LogoutButton } from './ui'

export default async function ProfilePage() {
  try {
    const { req } = await requireAuthedPayloadReqFromServer()
    const user = (req as any)?.user as { email?: string; name?: string; roles?: string[] } | undefined
    if (!user) redirect('/login?redirectTo=/profile')

    const roleLabel = isAdmin(user) ? 'Admin' : 'User'

    return (
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] overflow-hidden">
          <div className="p-6">
            <div className="text-xs uppercase tracking-widest text-white/60">Profile</div>
            <div className="text-2xl font-bold mt-1">{user.name ?? user.email ?? 'Account'}</div>
            <div className="text-sm text-white/60 mt-2">{user.email}</div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-widest text-white/60">Role</div>
                <div className="text-base font-semibold mt-1">{roleLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-widest text-white/60">Session</div>
                <div className="text-base font-semibold mt-1">Signed in</div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <LogoutButton />
              <a
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                href="/"
              >
                Back to loans
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  } catch {
    redirect('/login?redirectTo=/profile')
  }
}
