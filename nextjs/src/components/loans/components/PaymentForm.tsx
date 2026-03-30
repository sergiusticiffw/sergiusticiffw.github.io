'use client'

import React, { useEffect, useState } from 'react'

import type { ApiPaymentItem } from '../types'

type Props = {
  mode: 'create' | 'edit'
  loanId: string
  initial?: Partial<ApiPaymentItem>
  onSubmit: (values: ApiPaymentItem & { loanId: string }) => Promise<void>
  onCancel?: () => void
}

type PaymentFormValues = {
  id: string
  title: string
  field_date: string
  field_is_simulated_payment: boolean
  field_rate: number | ''
  field_pay_installment: number | ''
  field_pay_single_fee: number | ''
  field_new_recurring_amount: number | ''
  field_new_principal: number | ''
  field_payment_method: ApiPaymentItem['field_payment_method'] | '' // '' => keep/omit
}

export function PaymentForm({ mode, loanId, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<PaymentFormValues>(() => ({
    id: initial?.id ?? '',
    title: initial?.title ?? '',
    field_date: initial?.field_date ?? new Date().toISOString().slice(0, 10),
    field_is_simulated_payment: initial?.field_is_simulated_payment ?? false,
    field_rate: initial?.field_rate ?? '',
    field_pay_installment: initial?.field_pay_installment ?? '',
    field_pay_single_fee: initial?.field_pay_single_fee ?? '',
    field_new_recurring_amount: initial?.field_new_recurring_amount ?? '',
    field_new_principal: initial?.field_new_principal ?? '',
    field_payment_method: initial?.field_payment_method ?? '',
  }))

  useEffect(() => {
    setForm({
      id: initial?.id ?? '',
      title: initial?.title ?? '',
      field_date: initial?.field_date ?? new Date().toISOString().slice(0, 10),
      field_is_simulated_payment: initial?.field_is_simulated_payment ?? false,
      field_rate: initial?.field_rate ?? '',
      field_pay_installment: initial?.field_pay_installment ?? '',
      field_pay_single_fee: initial?.field_pay_single_fee ?? '',
      field_new_recurring_amount: initial?.field_new_recurring_amount ?? '',
      field_new_principal: initial?.field_new_principal ?? '',
      field_payment_method: initial?.field_payment_method ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id])

  const [submitting, setSubmitting] = useState(false)
  const canSubmit = Boolean(form.title) && Boolean(form.field_date)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!canSubmit || submitting) return
        setSubmitting(true)
        try {
          const apiPayment: ApiPaymentItem = {
            id: form.id,
            title: form.title,
            field_date: form.field_date,
            field_is_simulated_payment: form.field_is_simulated_payment,
            field_rate: form.field_rate === '' ? undefined : Number(form.field_rate),
            field_pay_installment: form.field_pay_installment === '' ? undefined : Number(form.field_pay_installment),
            field_pay_single_fee: form.field_pay_single_fee === '' ? undefined : Number(form.field_pay_single_fee),
            field_new_recurring_amount:
              form.field_new_recurring_amount === '' ? undefined : Number(form.field_new_recurring_amount),
            field_new_principal: form.field_new_principal === '' ? undefined : Number(form.field_new_principal),
            field_payment_method: form.field_payment_method === '' ? undefined : (form.field_payment_method as any),
          }

          await onSubmit({ ...apiPayment, loanId })
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
          <label className="block text-sm font-medium">Date</label>
          <input
            type="date"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_date ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, field_date: e.target.value }))}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium">Simulated</label>
            <label className="inline-flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={form.field_is_simulated_payment}
                onChange={(e) => setForm((p) => ({ ...p, field_is_simulated_payment: e.target.checked }))}
              />
              simulated payment
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">New rate</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_rate === '' ? '' : String(form.field_rate)}
            onChange={(e) =>
              setForm((p) => ({ ...p, field_rate: e.target.value === '' ? '' : Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Installment</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_pay_installment === '' ? '' : String(form.field_pay_installment)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_pay_installment: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Single fee</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_pay_single_fee === '' ? '' : String(form.field_pay_single_fee)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_pay_single_fee: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Recurring amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_new_recurring_amount === '' ? '' : String(form.field_new_recurring_amount)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_new_recurring_amount: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">New principal</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_new_principal === '' ? '' : String(form.field_new_principal)}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                field_new_principal: e.target.value === '' ? '' : Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Payment method</label>
          <select
            className="w-full rounded border border-white/15 bg-white/5 px-3 py-2"
            value={form.field_payment_method ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, field_payment_method: e.target.value as any }))}
          >
            <option value="">keep</option>
            <option value="equal_installment">equal_installment</option>
            <option value="equal_principal">equal_principal</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="rounded bg-[var(--color-app-accent)] px-4 py-2 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Add payment' : 'Update payment'}
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

