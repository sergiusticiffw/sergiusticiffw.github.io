'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
)

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js'
const MAX_RANGE_DAYS = 90

type WeekRatePoint = {
  date: string
  usd: number | null
  eur: number | null
}

const fieldClass =
  'w-full max-w-[300px] px-3.5 py-3 rounded-xl border border-white/20 bg-white/[0.06] text-inherit text-base'
const labelClass = 'block mb-1.5 text-sm'

function toIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultRangeIso(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6)
  return { from: toIsoLocal(from), to: toIsoLocal(to) }
}

function isoToDDMMYYYY(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return `${m[3]}.${m[2]}.${m[1]}`
}

function inclusiveDaysIso(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return Math.round((to - from) / 86_400_000) + 1
}

function shortLabel(bnmDate: string): string {
  const m = bnmDate.match(/^(\d{2})\.(\d{2})\./)
  return m ? `${m[1]}.${m[2]}` : bnmDate
}

function firstLastLabel(values: (number | null)[]): string | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  return `${present[0].toFixed(4)} → ${present[present.length - 1].toFixed(4)}`
}

export default function WeekChartPage() {
  const defaults = useMemo(() => defaultRangeIso(), [])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [ready, setReady] = useState(false)
  const [fromIso, setFromIso] = useState(defaults.from)
  const [toIso, setToIso] = useState(defaults.to)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<WeekRatePoint[] | null>(null)

  const fromBnm = useMemo(() => isoToDDMMYYYY(fromIso), [fromIso])
  const toBnm = useMemo(() => isoToDDMMYYYY(toIso), [toIso])
  const dayCount = useMemo(() => inclusiveDaysIso(fromIso, toIso), [fromIso, toIso])

  const rangeError = useMemo(() => {
    if (!fromBnm || !toBnm) return 'Invalid date.'
    if (dayCount == null) return 'Invalid date.'
    if (dayCount < 1) return 'From must be on or before To.'
    if (dayCount > MAX_RANGE_DAYS) return `Range too long. Maximum is ${MAX_RANGE_DAYS} days.`
    return null
  }, [fromBnm, toBnm, dayCount])

  useEffect(() => {
    const finish = () => {
      window.Telegram?.WebApp?.ready()
      window.Telegram?.WebApp?.expand()
      setReady(true)
    }

    const existing = document.querySelector(`script[src="${SCRIPT}"]`)
    if (existing && window.Telegram?.WebApp) {
      finish()
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = finish
    s.onerror = () => setReady(true)
    document.body.appendChild(s)
  }, [])

  useEffect(() => {
    if (rangeError || !fromBnm || !toBnm) {
      setPoints(null)
      setLoading(false)
      setError(rangeError)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ from: fromBnm!, to: toBnm! })
        const res = await fetch(`/api/bot/week-rates?${qs}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !Array.isArray(data.points)) {
          throw new Error(data?.error || 'Could not load rates.')
        }
        if (!cancelled) setPoints(data.points as WeekRatePoint[])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load rates.')
          setPoints(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [fromBnm, toBnm, rangeError])

  useEffect(() => {
    if (!points || !canvasRef.current) return

    chartRef.current?.destroy()

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: points.map((p) => shortLabel(p.date)),
        datasets: [
          {
            label: 'USD',
            data: points.map((p) => p.usd),
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            borderWidth: 2,
            spanGaps: false,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'EUR',
            data: points.map((p) => p.eur),
            borderColor: '#f87171',
            backgroundColor: 'rgba(248, 113, 113, 0.15)',
            borderWidth: 2,
            spanGaps: false,
            tension: 0.25,
            pointRadius: 4,
            pointHoverRadius: 6,
            hidden: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#ededed',
              boxWidth: 12,
              padding: 16,
            },
          },
          tooltip: {
            callbacks: {
              title(items) {
                const idx = items[0]?.dataIndex
                if (idx == null || !points[idx]) return ''
                return points[idx].date
              },
              label(ctx) {
                const v = ctx.parsed.y
                if (v == null) return `${ctx.dataset.label}: —`
                return `${ctx.dataset.label}: ${Number(v).toFixed(4)}`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: 'rgba(237, 237, 237, 0.75)' },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
          },
          y: {
            ticks: { color: 'rgba(237, 237, 237, 0.75)' },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
          },
        },
      },
    }

    chartRef.current = new Chart(canvasRef.current, config)

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [points])

  const usdSummary = points ? firstLastLabel(points.map((p) => p.usd)) : null
  const eurSummary = points ? firstLastLabel(points.map((p) => p.eur)) : null

  return (
    <div className="min-h-screen p-5 bg-[#0a0a0a] text-[#ededed] font-[system-ui,sans-serif]">
      <h1 className="text-xl mb-2">Week chart</h1>
      <p className="text-sm opacity-85 mb-4">
        BNM EUR &amp; USD — select a range (default last 7 days). Tap points for details.
      </p>

      <label className={labelClass} htmlFor="from">
        From
      </label>
      <input
        id="from"
        type="date"
        value={fromIso}
        onChange={(e) => setFromIso(e.target.value)}
        className={fieldClass}
      />

      <label className={`${labelClass} mt-4`} htmlFor="to">
        To
      </label>
      <input
        id="to"
        type="date"
        value={toIso}
        onChange={(e) => setToIso(e.target.value)}
        className={fieldClass}
      />

      {fromBnm && toBnm && !rangeError ? (
        <p className="mt-3 text-sm opacity-90">
          Range: <strong>{fromBnm}</strong> → <strong>{toBnm}</strong>
          {dayCount != null ? ` (${dayCount} days)` : null}
        </p>
      ) : null}

      {usdSummary || eurSummary ? (
        <p className="text-sm opacity-90 mt-3 mb-2">
          {usdSummary ? (
            <>
              USD: <strong>{usdSummary}</strong>
            </>
          ) : null}
          {usdSummary && eurSummary ? ' · ' : null}
          {eurSummary ? (
            <>
              EUR: <strong>{eurSummary}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      {loading ? <p className="mt-3 text-sm opacity-70">Loading rates…</p> : null}
      {error ? <p className="mt-3 text-[#f87171] text-sm">{error}</p> : null}

      {!loading && !error && points ? (
        <div className="relative w-full h-[320px] mt-3">
          <canvas ref={canvasRef} />
        </div>
      ) : null}

      {!ready ? <p className="mt-3.5 text-[0.85rem] opacity-70">Starting Telegram Web App…</p> : null}
    </div>
  )
}
