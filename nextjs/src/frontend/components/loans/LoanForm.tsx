'use client'

import React, { useEffect, useState } from 'react'

import type { ApiLoan } from '@/shared/types/loans'

type Props = {
  mode: 'create' | 'edit'
  initial?: Partial<ApiLoan>
  onSubmit: (values: ApiLoan) => Promise<void>
  onCancel?: () => void
}

const todayISO = () => new Date().toISOString().slice(0, 10)

type LoanFormValues = {
  id: string
  title: string
  field_principal: number | ''
  field_start_date: string
  field_end_date: string
  field_rate: number | ''
  field_initial_fee: number | ''
  field_rec_first_payment_date: string
  field_recurring_payment_day: number | ''
  field_payment_method: ApiLoan['field_payment_method']
  field_loan_status: ApiLoan['field_loan_status']
}

export function LoanForm({ mode, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<LoanFormValues>(() => ({
    id: initial?.id ?? '',
    title: initial?.title ?? '',
    field_principal: initial?.field_principal ?? '',
    field_start_date: initial?.field_start_date ?? todayISO(),
    field_end_date: initial?.field_end_date ?? todayISO(),
    field_rate: initial?.field_rate ?? '',
    field_initial_fee: initial?.field_initial_fee ?? '',
    field_rec_first_payment_date: initial?.field_rec_first_payment_date ?? '',
    field_recurring_payment_day: initial?.field_recurring_payment_day ?? '',
    field_payment_method: initial?.field_payment_method ?? 'equal_installment',
    field_loan_status: initial?.field_loan_status ?? 'draft',
  }))

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setForm((prev) => ({
        ...prev,
        id: initial.id ?? prev.id,
        title: initial.title ?? prev.title,
        field_principal: initial.field_principal ?? prev.field_principal,
        field_start_date: initial.field_start_date ?? prev.field_start_date,
        field_end_date: initial.field_end_date ?? prev.field_end_date,
        field_rate: initial.field_rate ?? prev.field_rate,
        field_initial_fee: initial.field_initial_fee ?? prev.field_initial_fee,
        field_rec_first_payment_date:
          initial.field_rec_first_payment_date ?? prev.field_rec_first_payment_date,
        field_recurring_payment_day:
          initial.field_recurring_payment_day ?? prev.field_recurring_payment_day,
        field_payment_method: initial.field_payment_method ?? prev.field_payment_method,
        field_loan_status: initial.field_loan_status ?? prev.field_loan_status,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id])

  const [submitting, setSubmitting] = useState(false)
  const canSubmit =
    Boolean(form.title) &&
    form.field_principal !== '' &&
    form.field_rate !== '' &&
    Boolean(form.field_start_date) &&
    Boolean(form.field_end_date) &&
    Boolean(form.field_payment_method) &&
    Boolean(form.field_loan_status)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!canSubmit || submitting) return
        setSubmitting(true)
        try {
          const apiLoan: ApiLoan = {
            id: form.id,
            title: form.title,
            field_principal: Number(form.field_principal),
            field_start_date: form.field_start_date,
            field_end_date: form.field_end_date,
            field_rate: Number(form.field_rate),
            field_initial_fee: form.field_initial_fee === '' ? undefined : Number(form.field_initial_fee),
            field_rec_first_payment_date:
              form.field_rec_first_payment_date === '' ? undefined : form.field_rec_first_payment_date,
            field_recurring_payment_day:
              form.field_recurring_payment_day === ''
                ? undefined
                : Number(form.field_recurring_payment_day),
            field_payment_method: form.field_payment_method,
            field_loan_status: form.field_loan_status,
          }
          await onSubmit(apiLoan)
        } finally {
          setSubmitting(false)
        }
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
          value={form.title ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Principal</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_principal === '' ? '' : String(form.field_principal)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_principal: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Rate</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_rate === '' ? '' : String(form.field_rate)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_rate: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Start date</label>
          <input
            type="date"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_start_date ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, field_start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">End date</label>
          <input
            type="date"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_end_date ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, field_end_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Initial fee</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_initial_fee === '' ? '' : String(form.field_initial_fee)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_initial_fee: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Recurring day</label>
          <input
            type="number"
            min="1"
            max="31"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_recurring_payment_day === '' ? '' : String(form.field_recurring_payment_day)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_recurring_payment_day: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">First payment date</label>
          <input
            type="date"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_rec_first_payment_date ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, field_rec_first_payment_date: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Payment method</label>
          <select
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_payment_method ?? 'equal_installment'}
            onChange={(e) => setForm((p) => ({ ...p, field_payment_method: e.target.value as ApiLoan['field_payment_method'] }))}
          >
            <option value="equal_installment">equal_installment</option>
            <option value="equal_principal">equal_principal</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Loan status</label>
        <select
          className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
          value={String(form.field_loan_status ?? 'draft')}
          onChange={(e) => setForm((p) => ({ ...p, field_loan_status: e.target.value as ApiLoan['field_loan_status'] }))}
        >
          <option value="in_progress">in_progress</option>
          <option value="draft">draft</option>
          <option value="completed">completed</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="rounded bg-[var(--color-app-accent)] px-4 py-2 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create loan' : 'Update loan'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded border border-white/15 px-4 py-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

