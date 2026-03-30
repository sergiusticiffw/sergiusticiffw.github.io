'use client'

import React, { useMemo } from 'react'

import type { PaydownResult, PaymentLog } from '@/shared/domain/loans/paydown-node'
import AmortizationTable, { type AmortizationRow } from './AmortizationTable'
import { LoanAnnualBreakdown, LoanCostBreakdown, LoanPrincipalOverTime } from './LoanCharts'

export default function LoanDetails({
  loan,
  loanData,
  amortizationSchedule = [],
}: {
  loan?: PaydownResult | null
  loanData: { principal: number; start_date: string }
  amortizationSchedule?: PaymentLog[]
}) {
  const annualSummaries = loan?.annual_summaries ?? {}

  const processedAmortizationSchedule: AmortizationRow[] = useMemo(() => {
    if (!amortizationSchedule?.length) return []

    const out: AmortizationRow[] = []
    let currentYear: string | null = null

    amortizationSchedule.forEach((paymentRow, index) => {
      const paymentDate = (paymentRow as any)?.date
      if (typeof paymentDate !== 'string') return
      const dateParts = paymentDate.split('.')
      if (dateParts.length < 3) return
      const paymentYear = dateParts[2]

      if (currentYear === null) currentYear = paymentYear

      const pushSummary = (year: string) => {
        const s = (annualSummaries as any)?.[year]
        if (!s) return
        out.push({
          type: 'annual_summary',
          year,
          totalPrincipal: s.total_principal,
          totalInterest: s.total_interest,
          totalFees: s.total_fees,
          totalPaid: s.total_principal + s.total_interest + s.total_fees,
        })
      }

      if (paymentYear !== currentYear) {
        pushSummary(currentYear)
        currentYear = paymentYear
      }

      out.push(paymentRow as any)

      if (index === amortizationSchedule.length - 1 && currentYear) {
        pushSummary(currentYear)
      }
    })

    return out
  }, [amortizationSchedule, annualSummaries])

  if (!amortizationSchedule?.length) {
    return <div className="text-white/70">No amortization data yet.</div>
  }

  const sumInstallments =
    (loan?.sum_of_installments ?? 0) +
    (loan?.remaining_principal ?? 0) +
    (loan?.unpaid_interest ?? 0) +
    (loan?.sum_of_fees ?? 0)

  const sumOfInterest = (loan?.sum_of_interests ?? 0) + (loan?.unpaid_interest ?? 0)

  const principalForChart = loan?.effective_principal ?? loanData.principal

  return (
    <div className="space-y-6">
      <LoanCostBreakdown
        data={{
          principal: principalForChart,
          sumOfInterest,
          sumInstallments,
        }}
      />

      {annualSummaries && Object.keys(annualSummaries).length > 0 ? (
        <LoanAnnualBreakdown annualSummaries={annualSummaries as any} />
      ) : null}

      <LoanPrincipalOverTime schedule={amortizationSchedule as any} />

      <AmortizationTable amortizationSchedule={processedAmortizationSchedule} />
    </div>
  )
}

