import { fetchBnmRatesForDate } from '@/server/bot/bnm'
import { getTodayDate, shiftBnmDate } from '@/server/bot/date'
import { sendTelegramMessage, sendTelegramPhoto } from '@/server/bot/telegram'

export type WeekRatePoint = {
  date: string
  usd: number | null
  eur: number | null
}

function parseRate(value: string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function fetchLastWeekRates(timeZone = 'Europe/Chisinau'): Promise<WeekRatePoint[]> {
  const today = getTodayDate(timeZone)
  const dates: string[] = []
  for (let offset = -6; offset <= 0; offset++) {
    const date = offset === 0 ? today : shiftBnmDate(today, offset)
    if (date) dates.push(date)
  }

  const results = await Promise.all(
    dates.map(async (date) => {
      const rates = await fetchBnmRatesForDate(date).catch(() => ({ usd: null, eur: null }))
      return {
        date,
        usd: parseRate(rates.usd),
        eur: parseRate(rates.eur),
      }
    }),
  )

  return results
}

function shortLabel(bnmDate: string): string {
  const m = bnmDate.match(/^(\d{2})\.(\d{2})\./)
  return m ? `${m[1]}.${m[2]}` : bnmDate
}

function firstLastLabel(values: (number | null)[]): string | null {
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  const first = present[0]
  const last = present[present.length - 1]
  return `${first.toFixed(4)} → ${last.toFixed(4)}`
}

export function buildWeekChartUrl(points: WeekRatePoint[]): string {
  const labels = points.map((p) => shortLabel(p.date))
  const usdData = points.map((p) => p.usd)
  const eurData = points.map((p) => p.eur)

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'USD',
          data: usdData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          fill: false,
          spanGaps: false,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: 'EUR',
          data: eurData,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.12)',
          fill: false,
          spanGaps: false,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      title: {
        display: true,
        text: 'BNM: EUR & USD — last 7 days',
      },
      legend: {
        display: true,
        position: 'bottom',
      },
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: false,
            },
          },
        ],
      },
    },
  }

  return `https://quickchart.io/chart?width=700&height=400&devicePixelRatio=2&c=${encodeURIComponent(JSON.stringify(config))}`
}

function buildCaption(points: WeekRatePoint[]): string {
  const usd = firstLastLabel(points.map((p) => p.usd))
  const eur = firstLastLabel(points.map((p) => p.eur))
  const segments: string[] = []
  if (usd) segments.push(`USD: ${usd}`)
  if (eur) segments.push(`EUR: ${eur}`)
  if (segments.length === 0) return 'BNM last 7 days'
  return `BNM last 7 days — ${segments.join(' | ')}`
}

export async function sendWeekChartMessage({
  botToken,
  chatId,
}: {
  botToken: string
  chatId: number
}): Promise<void> {
  const points = await fetchLastWeekRates()
  const hasAnyRate = points.some((p) => p.usd != null || p.eur != null)

  if (!hasAnyRate) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: 'Could not fetch BNM rates for the last 7 days. Try again later.',
    })
    return
  }

  const photoUrl = buildWeekChartUrl(points)
  const caption = buildCaption(points)

  try {
    await sendTelegramPhoto({ botToken, chatId, photoUrl, caption })
  } catch (err) {
    console.error('[weekChart] sendPhoto failed', err)
    await sendTelegramMessage({
      botToken,
      chatId,
      text: 'Could not send the week chart. Try again later.',
    })
  }
}
