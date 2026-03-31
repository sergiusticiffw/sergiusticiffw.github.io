'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { ApiLoan } from '@/shared/types/loans'
import { LoanForm } from './LoanForm'
import { getLoanStatus } from '@/shared/domain/loans/status'
import { createLoanAction, deleteLoanAction, updateLoanAction } from '@/frontend/actions/loans'
import { BottomSheet } from '@/frontend/components/ui/BottomSheet'

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmt = (v: unknown) => {
  if (v === '-' || v === '' || v == null) return '-'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? nf.format(n) : String(v)
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-sm border transition',
        active ? 'bg-white/10 border-white/15 text-white' : 'bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20'
      : status === 'pending'
        ? 'bg-amber-500/10 text-amber-300 border-amber-400/20'
        : 'bg-white/5 text-white/70 border-white/10'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${cls}`}>{status}</span>
}

function LoanCard({
  loan,
  onEdit,
  onDelete,
}: {
  loan: ApiLoan
  onEdit: (loan: ApiLoan) => void
  onDelete: (loan: ApiLoan) => void
}) {
  const status = getLoanStatus(String(loan.field_loan_status ?? ''))
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] hover:from-white/[0.08] hover:to-white/[0.03] transition overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">Loan</div>
            <div className="text-lg font-semibold mt-1">{loan.title}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            <button
              type="button"
              className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
              aria-label="Edit loan"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEdit(loan)
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="h-9 w-9 rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/15 transition"
              aria-label="Delete loan"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(loan)
              }}
            >
              🗑
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-widest text-white/60">Principal</div>
            <div className="text-base font-semibold tabular-nums mt-1">{fmt(loan.field_principal)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-widest text-white/60">Rate</div>
            <div className="text-base font-semibold tabular-nums mt-1">{loan.field_rate ?? '-'}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-white/60">
          <span className="uppercase tracking-widest text-[11px]">Start</span>{' '}
          <span className="tabular-nums text-white/80">{loan.field_start_date ?? '-'}</span>
          <span className="mx-2">•</span>
          <span className="uppercase tracking-widest text-[11px]">End</span>{' '}
          <span className="tabular-nums text-white/80">{loan.field_end_date ?? '-'}</span>
          </div>
          <Link
            href={`/loans/${loan.id}`}
            className="text-sm text-[var(--color-app-accent,#3b82f6)] hover:opacity-90 transition"
          >
            View →
          </Link>
        </div>
      </div>
    </div>
  )
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
  const [showEditSheet, setShowEditSheet] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all')
  const [query, setQuery] = useState('')

  const router = useRouter()

  useEffect(() => {
    setLoans(initialLoans)
  }, [initialLoans])

  const filteredLoans = useMemo(() => {
    if (!loans?.length) return []
    const byStatus =
      statusFilter === 'all' ? loans : loans.filter((l) => getLoanStatus(String(l.field_loan_status ?? '')) === statusFilter)
    const q = query.trim().toLowerCase()
    if (!q) return byStatus
    return byStatus.filter((l) => (l.title ?? '').toLowerCase().includes(q))
  }, [loans, query, statusFilter])

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

  const deleteLoan = async (loan: ApiLoan) => {
    if (!loan?.id) return
    const ok = window.confirm(`Delete "${loan.title ?? 'loan'}"? This cannot be undone.`)
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
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] overflow-hidden mb-5">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Dashboard</div>
              <h1 className="text-2xl font-bold mt-1">Loans</h1>
              <div className="text-sm text-white/60 mt-1">Mobile-first loan tracking with banking-style cards.</div>
            </div>
            <button
              className="rounded-2xl bg-[var(--color-app-accent,#3b82f6)] px-4 py-2 font-medium hover:opacity-90 transition"
              onClick={() => {
                setMode('create')
                setFocused(undefined)
                setShowForm(true)
              }}
            >
              + New loan
            </button>
          </div>

          <div className="mt-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white/60">
                <path
                  d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M21 21l-4.3-4.3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search loans…"
                className="bg-transparent outline-none w-full text-sm placeholder:text-white/40"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </Chip>
            <Chip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
              Active
            </Chip>
            <Chip active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>
              Pending
            </Chip>
            <Chip active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')}>
              Completed
            </Chip>
          </div>
        </div>
      </div>

      {loading && <div className="text-white/70">Loading…</div>}
      {error && <div className="text-red-400 mb-4">{error}</div>}

      {showForm && (
        <div className="mb-6 p-4 rounded-3xl border border-white/10 bg-white/[0.04]">
          <LoanForm
            mode={mode}
            initial={focused}
            onCancel={() => setShowForm(false)}
            onSubmit={submitLoan}
          />
        </div>
      )}

      {!loading && loans && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onEdit={(l) => {
                setMode('edit')
                setFocused(l)
                setShowEditSheet(true)
              }}
              onDelete={deleteLoan}
            />
          ))}
          {filteredLoans.length === 0 && <div className="text-white/60">No loans found.</div>}
        </div>
      )}

      <BottomSheet
        open={showEditSheet}
        title={mode === 'edit' ? 'Edit loan' : 'Loan'}
        onClose={() => setShowEditSheet(false)}
      >
        <LoanForm
          mode="edit"
          initial={focused}
          onCancel={() => setShowEditSheet(false)}
          onSubmit={submitLoan}
        />
      </BottomSheet>
    </div>
  )
}

