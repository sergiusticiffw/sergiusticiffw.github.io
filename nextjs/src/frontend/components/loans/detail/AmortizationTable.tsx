'use client'

import React from 'react'

type PaymentLog = {
  date: string
  rate: number | string
  installment: number | string
  reduction: number | string
  interest: number | string
  principal: number | string
  fee: number | string
  was_payed?: boolean | null
  num_days?: number | null
}

type AnnualSummaryRow = {
  type: 'annual_summary'
  year: string
  totalPrincipal: number
  totalInterest: number
  totalFees: number
  totalPaid: number
}

export type AmortizationRow = PaymentLog | AnnualSummaryRow

function isAnnualSummaryRow(row: AmortizationRow): row is AnnualSummaryRow {
  return (row as AnnualSummaryRow).type === 'annual_summary'
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmt = (v: unknown) => {
  if (v === '-' || v === '' || v == null) return '-'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? nf.format(n) : String(v)
}

export default function AmortizationTable({ amortizationSchedule }: { amortizationSchedule: AmortizationRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/5 text-white/70">
          <tr>
            <th className="px-3 py-2">Paid</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Rate</th>
            <th className="px-3 py-2">Days</th>
            <th className="px-3 py-2">Installment</th>
            <th className="px-3 py-2">Reduction</th>
            <th className="px-3 py-2">Interest</th>
            <th className="px-3 py-2">Principal</th>
            <th className="px-3 py-2">Fee</th>
          </tr>
        </thead>
        <tbody>
          {amortizationSchedule.map((row, idx) => {
            if (isAnnualSummaryRow(row)) {
              return (
                <tr key={`y-${row.year}-${idx}`} className="bg-white/10 font-semibold">
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{`Total ${row.year}`}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{fmt(row.totalPaid)}</td>
                  <td className="px-3 py-2">{fmt(row.totalPrincipal)}</td>
                  <td className="px-3 py-2">{fmt(row.totalInterest)}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{fmt(row.totalFees)}</td>
                </tr>
              )
            }

            const paid = row.was_payed ? 'bg-emerald-500/10' : ''
            return (
              <tr key={`${row.date}-${idx}`} className={`border-t border-white/10 ${paid}`}>
                <td className="px-3 py-2">
                  <span className={row.was_payed ? 'text-emerald-300' : 'text-white/40'}>
                    {row.was_payed ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                <td className="px-3 py-2">{fmt(row.rate)}</td>
                <td className="px-3 py-2">{fmt(row.num_days ?? '-')}</td>
                <td className="px-3 py-2">{fmt(row.installment)}</td>
                <td className="px-3 py-2">{fmt(row.reduction)}</td>
                <td className="px-3 py-2">{fmt(row.interest)}</td>
                <td className="px-3 py-2">{fmt(row.principal)}</td>
                <td className="px-3 py-2">{fmt(row.fee)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

