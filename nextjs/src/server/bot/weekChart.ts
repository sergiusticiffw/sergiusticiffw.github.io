import { fetchBnmRatesForDate } from '@/server/bot/bnm'
import { getTodayDate, shiftBnmDate } from '@/server/bot/date'

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
