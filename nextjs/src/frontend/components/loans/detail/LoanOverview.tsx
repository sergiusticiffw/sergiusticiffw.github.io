'use client'

import React, { useMemo } from 'react'

import type { PaydownInit, PaydownResult } from '@/shared/domain/loans/amortization'
import type { LoanStatus } from '@/shared/domain/loans/status'

function parseDMY(dmy: string): Date | null {
  const parts = dmy.split('.')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return Number.isFinite(d.getTime()) ? d : null
}

function diffInDays(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function diffInMonths(a: Date, b: Date) {
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  const adjust = b.getDate() < a.getDate() ? -1 : 0
  return Math.max(0, months + adjust)
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtMoney = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '-')

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/5 border border-white/10 mb-3 text-[var(--color-app-accent)]">
        {icon}
      </div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs tracking-widest text-white/60 mt-1 uppercase">{label}</div>
    </div>
  )
}

function Row({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-t border-white/10">
      <div className="flex items-center gap-2 text-white/70 text-sm">
        <span className="text-[var(--color-app-accent)]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

export default function LoanOverview({
  loanStatus,
  loanData,
  paydown,
  totalPaidAmount,
  interestSaved,
}: {
  loanStatus: LoanStatus
  loanData: PaydownInit
  paydown: PaydownResult
  totalPaidAmount: number
  interestSaved: number
}) {
  const today = useMemo(() => new Date(), [])

  const startDate = useMemo(() => parseDMY(loanData.start_date), [loanData.start_date])
  const endDate = useMemo(() => parseDMY(loanData.end_date), [loanData.end_date])

  const totalMonths = useMemo(() => {
    if (!startDate || !endDate) return null
    return diffInMonths(startDate, endDate)
  }, [startDate, endDate])

  const monthsPassed = useMemo(() => {
    if (!startDate) return null
    return diffInMonths(startDate, today)
  }, [startDate, today])

  const daysRemaining = useMemo(() => {
    if (!endDate) return null
    return Math.max(0, diffInDays(today, endDate))
  }, [endDate, today])

  const principal = paydown.effective_principal ?? loanData.principal ?? 0
  const principalPaid = paydown.sum_of_reductions_after_paid ?? paydown.sum_of_reductions ?? 0
  const remainingPrincipal = paydown.remaining_principal_after_paid ?? paydown.remaining_principal ?? 0

  const progressPct = useMemo(() => {
    // Match expenses behavior:
    // - pending(draft) => 0%
    // - completed => 100%
    // - active(in_progress) => compute from totalPaid / sum_of_installments
    if (loanStatus === 'completed') return 100
    if (loanStatus === 'pending') return 0

    const sumInstallments = paydown.sum_of_installments ?? 0
    if (!Number.isFinite(sumInstallments) || sumInstallments <= 0) return 0

    const progressValue = ((totalPaidAmount ?? 0) / sumInstallments) * 100
    return Math.max(0, Math.min(100, Math.round(progressValue)))
  }, [loanStatus, paydown.sum_of_installments, totalPaidAmount])

  const monthsPassedDisplay =
    loanStatus === 'active'
      ? `${monthsPassed ?? 0} / ${totalMonths ?? 0}`
      : loanStatus === 'completed'
        ? `${totalMonths ?? 0} / ${totalMonths ?? 0}`
        : 'Not started'

  const daysRemainingDisplay =
    loanStatus === 'active' ? String(daysRemaining ?? 0) : loanStatus === 'completed' ? 'Completed' : 'Not started'

  const interestSavedDisplay =
    loanStatus === 'pending' ? 'Not started' : interestSaved > 0 ? fmtMoney(interestSaved) : fmtMoney(0)

  const totalCost =
    (paydown.sum_of_installments ?? 0) +
    (paydown.remaining_principal ?? 0) +
    (paydown.unpaid_interest ?? 0) +
    (paydown.sum_of_fees ?? 0)

  const progressWidth = progressPct > 0 ? `max(8px, ${progressPct}%)` : '0%'

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mt-1">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-white/60">Progress</div>
            <div className="text-xs text-white/70">
              <span className="text-white font-semibold">{progressPct}%</span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-app-accent,#3b82f6)]"
              style={{ width: progressWidth }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-app-accent)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 11h10M7 15h7M8 3v3M16 3v3M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>
                Months Passed:{' '}
                <span className="text-white font-semibold">
                  {monthsPassedDisplay}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-app-accent)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>
                Days Remaining:{' '}
                <span className="text-white font-semibold">{daysRemainingDisplay}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5">
          <StatCard
            label="Principal"
            value={fmtMoney(principal)}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 7h18v10H3V7Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M7 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            }
          />
          <StatCard
            label="Paid"
            value={fmtMoney(totalPaidAmount)}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 7 10 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Remaining"
            value={fmtMoney(remainingPrincipal)}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4">
          <Row
            label="Start date"
            value={loanData.start_date}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 11h10M8 3v3M16 3v3M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Row
            label="End date"
            value={paydown.actual_end_date ?? loanData.end_date}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 11h10M7 15h7M8 3v3M16 3v3M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Row
            label="Total"
            value={fmtMoney(totalCost)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19V5m0 14h16M8 15v-3M12 15V8M16 15v-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <Row
            label="Interest Paid"
            value={fmtMoney(paydown.interest_paid ?? 0)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v18M8 7h8M8 17h8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Row
            label="Interest Saved"
            value={interestSavedDisplay}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v4m0 16v-4M4.93 4.93l2.83 2.83m11.31 11.31 2.83 2.83M2 12h4m16 0h-4M4.93 19.07l2.83-2.83m11.31-11.31 2.83-2.83"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <Row
            label="Principal Paid"
            value={fmtMoney(principalPaid)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 12l2.5 2.5L16 9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <Row
            label="Remaining Principal"
            value={fmtMoney(remainingPrincipal)}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 7v5l3 2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  )
}

