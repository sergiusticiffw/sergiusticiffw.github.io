'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { ApiLoan } from '@/shared/types/loans'
import { LoanForm } from './LoanForm'
import { getLoanStatus } from '@/shared/domain/loans/status'
import { createLoanAction, deleteLoanAction, updateLoanAction } from '@/frontend/actions/loans'

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmt = (v: unknown) => {
  if (v === '-' || v === '' || v == null) return '-'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? nf.format(n) : String(v)
}

type Props = {
  initialLoans: ApiLoan[]
}

export default function LoansClient({ initialLoans }: Props) {
  const [loans, setLoans] = useState<ApiLoan[]>(initialLoans)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [focused, setFocused] = useState<Partial<ApiLoan> | undefined>(undefined)
  const [showForm, setShowForm] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all')

  const router = useRouter()

  useEffect(() => {
    setLoans(initialLoans)
  }, [initialLoans])

  const filteredLoans = useMemo(() => {
    if (!loans?.length) return []
    if (statusFilter === 'all') return loans
    return loans.filter((l) => getLoanStatus(String(l.field_loan_status ?? '')) === statusFilter)
  }, [loans, statusFilter])

  const submitLoan = async (values: ApiLoan) => {
    setLoading(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createLoanAction({
          title: values.title ?? '',
          field_principal: values.field_principal,
          field_start_date: values.field_start_date,
          field_end_date: values.field_end_date,
          field_rate: values.field_rate,
          field_initial_fee: values.field_initial_fee,
          field_rec_first_payment_date: values.field_rec_first_payment_date,
          field_recurring_payment_day: values.field_recurring_payment_day,
          field_payment_method: values.field_payment_method,
          field_loan_status: values.field_loan_status,
        })
      } else {
        await updateLoanAction({
          loanId: values.id,
          title: values.title ?? '',
          field_principal: values.field_principal,
          field_start_date: values.field_start_date,
          field_end_date: values.field_end_date,
          field_rate: values.field_rate,
          field_initial_fee: values.field_initial_fee,
          field_rec_first_payment_date: values.field_rec_first_payment_date,
          field_recurring_payment_day: values.field_recurring_payment_day,
          field_payment_method: values.field_payment_method,
          field_loan_status: values.field_loan_status,
        })
      }

      setShowForm(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save loan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <div className="text-sm text-white/60 mt-1">Manage your loans and payment schedules.</div>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded border border-white/15 bg-white/5 px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
          </select>
          <button
            className="rounded bg-[var(--color-app-accent)] px-4 py-2 font-medium hover:opacity-90 transition"
            onClick={() => {
              setMode('create')
              setFocused(undefined)
              setShowForm(true)
            }}
          >
            Create loan
          </button>
        </div>
      </div>

      {loading && <div className="text-white/70">Loading…</div>}
      {error && <div className="text-red-400 mb-4">{error}</div>}

      {showForm && (
        <div className="mb-6 p-4 rounded border border-white/10 bg-white/5">
          <LoanForm
            mode={mode}
            initial={focused}
            onCancel={() => setShowForm(false)}
            onSubmit={submitLoan}
          />
        </div>
      )}

      {!loading && loans && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-white/[0.04]">
              <tr className="text-white/60 text-sm">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Principal</th>
                <th className="py-2 pr-3">Rate</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan) => {
                const status = getLoanStatus(String(loan.field_loan_status ?? ''))
                const statusClass =
                  status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20'
                    : status === 'pending'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-400/20'
                      : 'bg-white/5 text-white/70 border-white/10'
                return (
                  <tr key={loan.id} className="border-t border-white/10 hover:bg-white/[0.03] transition">
                    <td className="py-3 pr-3">
                      <Link className="text-[var(--color-app-accent)] hover:underline" href={`/loans/${loan.id}`}>
                        {loan.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">{fmt(loan.field_principal)}</td>
                    <td className="py-3 pr-3">{loan.field_rate ?? '-'}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${statusClass}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                      <button
                        className="rounded border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition"
                        onClick={() => {
                          setMode('edit')
                          setFocused(loan)
                          setShowForm(true)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-red-300 hover:bg-red-500/15 transition"
                        onClick={async () => {
                          if (!loan.id) return
                          const ok = confirm('Delete this loan?')
                          if (!ok) return
                          setLoading(true)
                          setError(null)
                          try {
                            await deleteLoanAction(String(loan.id))
                            router.refresh()
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Failed to delete loan')
                          } finally {
                            setLoading(false)
                          }
                        }}
                      >
                        Delete
                      </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredLoans.length === 0 && <div className="text-white/60 mt-4">No loans found.</div>}
        </div>
      )}
    </div>
  )
}

