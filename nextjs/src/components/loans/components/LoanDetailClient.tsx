'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ApiLoan, ApiPaymentItem } from '../types'
import { PaymentForm } from './PaymentForm'
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
  isEarlyPaymentFromApiItem,
} from '@/utilities/loans/amortization'
import { getLoanStatus } from '@/utilities/loans/status'
import {
  createPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from '@/utilities/loans/server/actions'

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

  const scheduledPayments = useMemo(() => {
    return sortPaymentsByDate(payments).filter((p) => !isEarlyPaymentFromApiItem(p))
  }, [payments])

  const amort = useMemo(() => {
    if (!loan) return null
    const loanData = buildLoanDataFromApiLoan(loan)
    if (!loanData) return null
    const events = buildEventsFromApiPayments(scheduledPayments)
    return calculateAmortization(loanData, events)
  }, [loan, scheduledPayments])

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
        <h1 className="text-2xl font-bold">{loan.title}</h1>
        <div className="text-white/70 mt-1">
          Status: {status} | Principal: {loan.field_principal ?? '-'} | Rate: {loan.field_rate ?? '-'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded border border-white/10 bg-white/5">
          <h2 className="font-semibold mb-2">Amortization summary</h2>
          {amort ? (
            <div className="space-y-1 text-sm">
              <div>Principal paid: {amort.paydown.sum_of_reductions ?? 0}</div>
              <div>Interests paid: {amort.paydown.sum_of_interests ?? 0}</div>
              <div>Fees: {amort.paydown.sum_of_fees ?? 0}</div>
              <div>Effective principal: {amort.paydown.effective_principal ?? 0}</div>
              <div>Total paid (actual payments only): {totalPaidAmount}</div>
            </div>
          ) : (
            <div className="text-white/70">Not enough data to calculate.</div>
          )}
        </div>

        <div className="p-4 rounded border border-white/10 bg-white/5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">Payments</h2>
            <button
              className="rounded bg-[var(--color-app-accent)] px-4 py-2"
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
            <div className="mb-4 p-3 rounded border border-white/10 bg-white/5">
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
              <div key={p.id} className="rounded border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-white/70 text-xs">{p.field_date}</div>
                  </div>
                  <div className="text-sm text-right">
                    <div>{p.field_pay_installment ?? '-'} installment</div>
                    {p.field_is_simulated_payment && (
                      <div className="text-[var(--color-app-accent)] text-xs">simulated</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-sm"
                    onClick={() => {
                      setMode('edit')
                      setFocusedPayment(p)
                      setShowPaymentForm(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-red-300 text-sm"
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

      {amort?.schedule?.length ? (
        <div className="p-4 rounded border border-white/10 bg-white/5">
          <h2 className="font-semibold mb-2">Schedule preview</h2>
          <div className="text-white/60 text-sm mb-2">First 12 periods (scheduled)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Installment</th>
                  <th className="py-2 pr-3">Reduction</th>
                  <th className="py-2 pr-3">Interest</th>
                  <th className="py-2 pr-3">Principal</th>
                  <th className="py-2 pr-3">Fee</th>
                </tr>
              </thead>
              <tbody>
                {amort.schedule.slice(0, 12).map((row, idx) => (
                  <tr key={idx} className="border-t border-white/10">
                    <td className="py-2 pr-3">{row.date}</td>
                    <td className="py-2 pr-3">{row.installment}</td>
                    <td className="py-2 pr-3">{row.reduction}</td>
                    <td className="py-2 pr-3">{row.interest}</td>
                    <td className="py-2 pr-3">{row.principal}</td>
                    <td className="py-2 pr-3">{row.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

