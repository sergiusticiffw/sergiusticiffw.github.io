import type { Access, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { authenticated } from '@/payload/access/authenticated'
import { isAdmin, toISODate } from '@/shared/utilities/payload/common'

const ownPaymentsOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true

  return {
    field_owner: {
      equals: user.id,
    },
  }
}

export const Payments: CollectionConfig<'payments'> = {
  slug: 'payments',
  access: {
    create: authenticated,
    delete: ownPaymentsOnly,
    admin: authenticated,
    read: ownPaymentsOnly,
    update: ownPaymentsOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'title',
      'field_date',
      'field_payment_method',
      'field_is_simulated_payment',
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
      name: 'field_date',
      type: 'date',
      required: true,
    },
    {
      name: 'field_rate',
      type: 'number',
      required: false,
    },
    {
      name: 'field_pay_installment',
      type: 'number',
      required: false,
    },
    {
      name: 'field_pay_single_fee',
      type: 'number',
      required: false,
    },
    {
      name: 'field_new_recurring_amount',
      type: 'number',
      required: false,
    },
    {
      name: 'field_new_principal',
      type: 'number',
      required: false,
    },
    {
      name: 'field_payment_method',
      type: 'select',
      required: false,
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
      name: 'field_is_simulated_payment',
      type: 'checkbox',
      required: true,
      defaultValue: false,
    },
    {
      name: 'field_loan_reference',
      type: 'relationship',
      relationTo: 'loans',
      required: true,
      access: {
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => Boolean(req.user),
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const user = req.user as any
        if (!user) return data

        if (isAdmin(user)) return data

        const maybeLoanRef = data.field_loan_reference
        const shouldValidateLoan = operation === 'create' || (operation === 'update' && maybeLoanRef != null)

        if (shouldValidateLoan) {
          const loanIdNum = Number(maybeLoanRef)
          if (!Number.isFinite(loanIdNum)) {
            throw new APIError('Invalid loan reference', 400)
          }

          try {
            await req.payload.findByID({
              collection: 'loans',
              id: loanIdNum,
              depth: 0,
              overrideAccess: false,
              req: req as any,
            })
          } catch {
            throw new APIError('Forbidden', 403)
          }
        }

        // On create, force ownership to the current user.
        if (operation === 'create') {
          return Object.assign(data, { field_owner: user.id })
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        const d: any = doc
        // Normalize date field to `YYYY-MM-DD` without adding abbreviation keys.
        d.field_date = d.field_date ? toISODate(d.field_date) : d.field_date
        return d
      },
    ],
  },
}
