import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '@/access/authenticated'
import { isAdmin, toISODate } from '@/utilities/payload/common'

const ownLoansOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true

  return {
    field_owner: {
      equals: user.id,
    },
  }
}

export const Loans: CollectionConfig<'loans'> = {
  slug: 'loans',
  access: {
    create: authenticated,
    delete: ownLoansOnly,
    admin: authenticated,
    read: ownLoansOnly,
    update: ownLoansOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'title',
      'field_principal',
      'field_rate',
      'field_payment_method',
      'field_loan_status',
      'createdAt',
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      // Ownership for row-level security
      name: 'field_owner',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        readOnly: true,
      },
      access: {
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => isAdmin(req.user),
      },
    },
    {
      name: 'field_principal',
      type: 'number',
      required: true,
    },
    {
      name: 'field_start_date',
      type: 'date',
      required: true,
    },
    {
      name: 'field_end_date',
      type: 'date',
      required: true,
    },
    {
      name: 'field_rate',
      type: 'number',
      required: true,
    },
    {
      name: 'field_initial_fee',
      type: 'number',
      required: false,
    },
    {
      name: 'field_rec_first_payment_date',
      type: 'date',
      required: false,
    },
    {
      name: 'field_recurring_payment_day',
      type: 'number',
      required: false,
    },
    {
      name: 'field_payment_method',
      type: 'select',
      required: true,
      options: [
        {
          label: 'equal_installment',
          value: 'equal_installment',
        },
        {
          label: 'equal_principal',
          value: 'equal_principal',
        },
      ],
    },
    {
      name: 'field_loan_status',
      type: 'select',
      required: true,
      options: [
        {
          label: 'in_progress',
          value: 'in_progress',
        },
        {
          label: 'draft',
          value: 'draft',
        },
        {
          label: 'completed',
          value: 'completed',
        },
      ],
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const user = req.user as any
        if (!user) return data

        // Only force ownership on create for non-admins.
        if (!isAdmin(user) && operation === 'create') {
          return Object.assign(data, { field_owner: user.id })
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Normalize date fields to `YYYY-MM-DD` without adding abbreviation keys.
        const d: any = doc
        d.field_start_date = d.field_start_date ? toISODate(d.field_start_date) : d.field_start_date
        d.field_end_date = d.field_end_date ? toISODate(d.field_end_date) : d.field_end_date
        d.field_rec_first_payment_date = d.field_rec_first_payment_date
          ? toISODate(d.field_rec_first_payment_date)
          : d.field_rec_first_payment_date

        return d
      },
    ],
  },
}
