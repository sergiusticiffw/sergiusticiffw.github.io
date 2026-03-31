import type { Access, CollectionConfig, PayloadRequest } from 'payload'

import { authenticated } from '@/payload/access/authenticated'
import { anyone } from '@/payload/access/anyone'

import { isAdmin } from '@/shared/utilities/payload/common'

const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

const adminDashboardOnly = ({ req }: { req: PayloadRequest }) => isAdmin(req.user)

const ownUserOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true

  return {
    id: {
      equals: user.id,
    },
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Restrict Payload Admin dashboard to admins only.
    admin: adminDashboardOnly,
    // Public sign-up + OAuth auto-provisioning needs this.
    create: anyone,
    delete: adminOnly,
    read: ownUserOnly,
    update: ownUserOnly,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data

        // Prevent privilege escalation: only admins can create non-user roles.
        if (!isAdmin(req.user)) {
          return { ...(data ?? {}), roles: ['user'] }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['user'],
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      saveToJWT: true,
      access: {
        // Prevent privilege escalation via the `roles` field
        update: ({ req: { user } }) => isAdmin(user),
      },
    },
  ],
  timestamps: true,
}
