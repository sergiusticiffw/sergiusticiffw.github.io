import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

type AdminAccess = (args: AccessArgs<User>) => boolean

// Payload admin access: only users with `roles` including "admin"
export const adminOnly: AdminAccess = ({ req: { user } }) => {
  if (!user) return false

  const roles = (user as unknown as { roles?: string[] | null }).roles
  return Boolean(roles?.includes('admin'))
}

