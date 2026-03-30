'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ApiLoan, ApiPaymentItem } from '@/shared/types/loans'
import { PaymentForm } from './PaymentForm'
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
  isEarlyPaymentFromApiItem,
} from '@/shared/domain/loans/amortization'
import { getLoanStatus } from '@/shared/domain/loans/status'
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from '@/frontend/actions/loans'
import LoanDetails from './detail/LoanDetails'
import LoanOverview from './detail/LoanOverview'

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmt = (v: unknown) => {
  if (v === '-' || v === '' || v == null) return '-'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? nf.format(n) : String(v)
}

function sortPaymentsByDate(items: ApiPaymentItem[]) {
  return [...items].sort((a, b) => {
    const da = new Date(a.field_date ?? 0).getTime()
    const db = new Date(b.field_date ?? 0).getTime()
    return da - db
  })
}

type Props = {
  loanId: string
  initialLoan: ApiLoan | null
  initialPayments: ApiPaymentItem[]
}

export default function LoanDetailClient({ loanId, initialLoan, initialPayments }: Props) {
  const [loan, setLoan] = useState<ApiLoan | null>(initialLoan)
  const [payments, setPayments] = useState<ApiPaymentItem[]>(initialPayments)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [focusedPayment, setFocusedPayment] = useState<Partial<ApiPaymentItem> | undefined>(undefined)

  const router = useRouter()

  useEffect(() => {
    setLoan(initialLoan)
    setPayments(initialPayments)
    setError(null)
    setLoading(false)
  }, [initialLoan, initialPayments])

  const paymentsByDate = useMemo(() => {
    return sortPaymentsByDate(payments)
  }, [payments])

  const amort = useMemo(() => {
    if (!loan) return null
    const loanData = buildLoanDataFromApiLoan(loan)
    if (!loanData) return null
    const events = buildEventsFromApiPayments(paymentsByDate)
    return calculateAmortization(loanData, events)
  }, [loan, paymentsByDate])

  const loanData = useMemo(() => (loan ? buildLoanDataFromApiLoan(loan) : null), [loan])

  const totalPaidAmount = useMemo(() => {
    return payments.reduce(
      (sum, p) => sum + parseFloat(String(p.field_pay_installment ?? '0') || '0'),
      0,
    )
  }, [payments])

  const status = getLoanStatus(String(loan?.field_loan_status ?? ''))

  const handleSubmitPayment = async (values: ApiPaymentItem & { loanId: string }) => {
    const payload: {
      loanId: string
      title: string
      field_date: string
      field_is_simulated_payment: boolean
      field_rate?: number
      field_pay_installment?: number
      field_pay_single_fee?: number
      field_new_recurring_amount?: number
      field_new_principal?: number
      field_payment_method?: ApiPaymentItem['field_payment_method']
    } = {
      loanId: values.loanId,
      title: values.title ?? '',
      field_date: values.field_date,
      field_rate: values.field_rate,
      field_pay_installment: values.field_pay_installment,
      field_pay_single_fee: values.field_pay_single_fee,
      field_new_recurring_amount: values.field_new_recurring_amount,
      field_new_principal: values.field_new_principal,
      field_payment_method: values.field_payment_method,
      field_is_simulated_payment: values.field_is_simulated_payment,
    }

    setLoading(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createPaymentAction(payload)
      } else {
        if (!values.id) throw new Error('Missing payment id')
        await updatePaymentAction({
          ...payload,
          paymentId: String(values.id),
        })
      }

      setShowPaymentForm(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save payment')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8 text-white/70">Loading…</div>
  if (error) return <div className="max-w-5xl mx-auto px-4 py-8 text-red-400">{error}</div>
  if (!loan) return <div className="max-w-5xl mx-auto px-4 py-8 text-white/70">Loan not found.</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition mb-3"
          onClick={() => router.push('/loans')}
        >
          <span aria-hidden="true">←</span>
          Back to loans
        </button>
        <h1 className="text-2xl font-bold">{loan.title}</h1>
        <div className="text-white/70 mt-1">
          Status: {status} | Principal: {loan.field_principal ?? '-'} | Rate: {loan.field_rate ?? '-'}
        </div>
      </div>

      {amort && loanData ? (
        <div className="mb-6">
          <LoanOverview
            loanTitle={loan.title ?? `Loan ${loanId}`}
            loanData={loanData}
            paydown={amort.paydown}
            totalPaidAmount={totalPaidAmount}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">Payments</h2>
            <button
              className="rounded bg-[var(--color-app-accent)] px-4 py-2 font-medium hover:opacity-90 transition"
              onClick={() => {
                setMode('create')
                setFocusedPayment(undefined)
                setShowPaymentForm(true)
              }}
            >
              Add payment
            </button>
          </div>

          {showPaymentForm && (
            <div className="mb-4 p-3 rounded-xl border border-white/10 bg-white/5">
              <PaymentForm
                mode={mode}
                loanId={loanId}
                initial={focusedPayment}
                onCancel={() => setShowPaymentForm(false)}
                onSubmit={handleSubmitPayment}
              />
            </div>
          )}

          <div className="space-y-2">
            {payments.length === 0 && <div className="text-white/70 text-sm">No payments yet.</div>}
            {sortPaymentsByDate(payments).map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-white/70 text-xs">{p.field_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums">{fmt(p.field_pay_installment)}</div>
                    <div className="text-xs text-white/60">
                      {p.field_is_simulated_payment ? 'simulated' : 'paid'}
                      {p.field_pay_single_fee ? ` • fee ${fmt(p.field_pay_single_fee)}` : ''}
                      {p.field_new_principal != null ? ` • new principal ${fmt(p.field_new_principal)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition"
                    onClick={() => {
                      setMode('edit')
                      setFocusedPayment(p)
                      setShowPaymentForm(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-red-300 text-sm hover:bg-red-500/15 transition"
                    onClick={async () => {
                      if (!p.id) return
                      const ok = confirm('Delete this payment?')
                      if (!ok) return
                      setLoading(true)
                      setError(null)
                      try {
                        await deletePaymentAction({ paymentId: String(p.id), loanId })
                        router.refresh()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to delete payment')
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {amort && loanData ? (
        <div className="p-4 rounded border border-white/10 bg-white/5">
          <LoanDetails
            loan={amort.paydown}
            loanData={{ principal: loanData.principal, start_date: loanData.start_date }}
            amortizationSchedule={amort.schedule}
          />
        </div>
      ) : null}
    </div>
  )
}

