'use client'

import { useEffect, useRef, useState } from 'react'
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

type WeekRatePoint = {
  date: string
  usd: number | null
  eur: number | null
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [points, setPoints] = useState<WeekRatePoint[] | null>(null)

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
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/bot/week-rates')
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
  }, [])

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
      <p className="text-sm opacity-85 mb-4">BNM EUR &amp; USD — last 7 days. Tap points for details.</p>

      {usdSummary || eurSummary ? (
        <p className="text-sm opacity-90 mb-4">
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

      {loading ? <p className="text-sm opacity-70">Loading rates…</p> : null}
      {error ? <p className="text-[#f87171] text-sm">{error}</p> : null}

      {!loading && !error && points ? (
        <div className="relative w-full h-[320px] mt-2">
          <canvas ref={canvasRef} />
        </div>
      ) : null}

      {!ready ? <p className="mt-3.5 text-[0.85rem] opacity-70">Starting Telegram Web App…</p> : null}
    </div>
  )
}
