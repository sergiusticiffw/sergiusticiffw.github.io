'use client'

import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'

type PaymentLogLike = {
  date: string
  principal: number | string
  installment?: number | string
  reduction: number | string
  interest: number | string
  fee?: number | string
  was_payed?: boolean | null
}

function parseDateToUtcMs(date: string): number | null {
  const parts = date.split('.')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map((p) => Number(p))
  if (!dd || !mm || !yyyy) return null
  return Date.UTC(yyyy, mm - 1, dd)
}

function toNum(v: unknown): number | null {
  if (v === '-' || v === '' || v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export const LoanCostBreakdown = ({
  data,
  currency = 'RON',
}: {
  data: { principal: number; sumOfInterest: number; sumInstallments: number }
  currency?: string
}) => {
  const { principal, sumOfInterest, sumInstallments } = data

  const textColor = '#e5e7eb' // Tailwind gray-200-ish
  const mutedTextColor = '#9ca3af' // Tailwind gray-400-ish

  const options: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Loan cost breakdown', style: { color: textColor } },
    xAxis: {
      categories: ['Principal', 'Interests', 'Installments'],
      labels: { style: { color: mutedTextColor } },
    },
    yAxis: {
      min: 0,
      title: { text: currency, style: { color: textColor } },
      labels: { style: { color: mutedTextColor } },
    },
    tooltip: { valueDecimals: 2 },
    legend: { enabled: false },
    series: [
      {
        type: 'column',
        name: 'Total',
        colorByPoint: true,
        data: [principal, sumOfInterest, sumInstallments],
      },
    ],
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}

export const LoanPrincipalOverTime = ({
  schedule,
  currency = 'RON',
}: {
  schedule: PaymentLogLike[]
  currency?: string
}) => {
  const actual: Array<[number, number]> = []
  const simulated: Array<[number, number]> = []

  for (const row of schedule) {
    const x = parseDateToUtcMs(row.date)
    const y = toNum(row.principal)
    const hasPaymentValues = toNum(row.reduction) != null || toNum(row.interest) != null
    if (x == null || y == null || !hasPaymentValues) continue
    if (row.was_payed === true) actual.push([x, y])
    else simulated.push([x, y])
  }

  const textColor = '#e5e7eb' // gray-200
  const mutedTextColor = '#9ca3af' // gray-400

  const options: Highcharts.Options = {
    chart: { type: 'line', backgroundColor: 'transparent' },
    title: { text: 'Remaining principal', style: { color: '#e5e7eb' } },
    xAxis: {
      type: 'datetime',
      labels: { style: { color: '#9ca3af' } },
    },
    yAxis: {
      min: 0,
      title: { text: currency, style: { color: '#e5e7eb' } },
      labels: { style: { color: '#9ca3af' } },
    },
    legend: {
      enabled: true,
      itemStyle: { color: mutedTextColor, fontWeight: '600' },
      itemHoverStyle: { color: textColor },
    },
    tooltip: { valueDecimals: 2 },
    series: [
      { type: 'line', name: 'Active', data: actual },
      { type: 'line', name: 'Pending', data: simulated, dashStyle: 'ShortDash', opacity: 0.7 },
    ],
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}

export const LoanAnnualBreakdown = ({
  annualSummaries,
  currency = 'RON',
}: {
  annualSummaries: Record<string, { total_principal: number; total_interest: number; total_fees: number }>
  currency?: string
}) => {
  const years = Object.keys(annualSummaries ?? {}).sort()
  const principal = years.map((y) => annualSummaries[y]?.total_principal ?? 0)
  const interest = years.map((y) => annualSummaries[y]?.total_interest ?? 0)
  const fees = years.map((y) => annualSummaries[y]?.total_fees ?? 0)

  const textColor = '#e5e7eb' // Tailwind gray-200-ish
  const mutedTextColor = '#9ca3af' // Tailwind gray-400-ish

  const options: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent' },
    title: { text: 'Annual breakdown', style: { color: textColor } },
    xAxis: { categories: years, labels: { style: { color: mutedTextColor } } },
    yAxis: {
      min: 0,
      title: { text: currency, style: { color: textColor } },
      labels: { style: { color: mutedTextColor } },
    },
    legend: {
      enabled: true,
      itemStyle: { color: mutedTextColor, fontWeight: '600' },
      itemHoverStyle: { color: textColor },
    },
    tooltip: { shared: true, valueDecimals: 2 },
    plotOptions: { column: { stacking: 'normal' } },
    series: [
      { type: 'column', name: 'Principal', data: principal },
      { type: 'column', name: 'Interests', data: interest },
      { type: 'column', name: 'Fees', data: fees },
    ],
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}

