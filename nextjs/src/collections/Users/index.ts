import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '@/access/authenticated'

const isAdmin = (user: any) => Boolean(user?.roles?.includes('admin'))

const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

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
    // Non-admin users can still access the collection in admin UI,
    // but read/update/delete are constrained below.
    admin: authenticated,
    create: adminOnly,
    delete: adminOnly,
    read: ownUserOnly,
    update: ownUserOnly,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
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
