import { fetchBnmRatesForDate } from '@/server/bot/bnm'
import { getTodayDate, shiftBnmDate } from '@/server/bot/date'

export type WeekRatePoint = {
  date: string
  usd: number | null
  eur: number | null
}

export const MAX_RANGE_DAYS = 90

const BNM_DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/

function parseRate(value: string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function bnmToUtcMs(bnmDate: string): number | null {
  const m = bnmDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

/** Inclusive day count between two DD.MM.YYYY dates. Null if invalid. */
export function inclusiveDayCount(fromBnm: string, toBnm: string): number | null {
  const fromMs = bnmToUtcMs(fromBnm)
  const toMs = bnmToUtcMs(toBnm)
  if (fromMs == null || toMs == null) return null
  const diff = Math.round((toMs - fromMs) / 86_400_000)
  if (!Number.isFinite(diff)) return null
  return diff + 1
}

export function isValidBnmDate(value: string): boolean {
  return BNM_DATE_RE.test(value) && bnmToUtcMs(value) != null
}

export type RangeValidationError = 'invalid_format' | 'from_after_to' | 'too_long'

export function validateRateRange(
  fromBnm: string,
  toBnm: string,
): { ok: true; days: number } | { ok: false; error: RangeValidationError } {
  if (!isValidBnmDate(fromBnm) || !isValidBnmDate(toBnm)) {
    return { ok: false, error: 'invalid_format' }
  }
  const days = inclusiveDayCount(fromBnm, toBnm)
  if (days == null) return { ok: false, error: 'invalid_format' }
  if (days < 1) return { ok: false, error: 'from_after_to' }
  if (days > MAX_RANGE_DAYS) return { ok: false, error: 'too_long' }
  return { ok: true, days }
}

function datesInRange(fromBnm: string, toBnm: string): string[] {
  const days = inclusiveDayCount(fromBnm, toBnm)
  if (days == null || days < 1) return []
  const dates: string[] = [fromBnm]
  for (let i = 1; i < days; i++) {
    const next = shiftBnmDate(fromBnm, i)
    if (!next) break
    dates.push(next)
  }
  return dates
}

export async function fetchRatesForRange(
  fromBnm: string,
  toBnm: string,
): Promise<WeekRatePoint[]> {
  const dates = datesInRange(fromBnm, toBnm)
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

/** Last 7 calendar days ending today (Europe/Chisinau). */
export async function fetchLastWeekRates(timeZone = 'Europe/Chisinau'): Promise<WeekRatePoint[]> {
  const to = getTodayDate(timeZone)
  const from = shiftBnmDate(to, -6) ?? to
  return fetchRatesForRange(from, to)
}

export function defaultLastWeekRange(timeZone = 'Europe/Chisinau'): { from: string; to: string } {
  const to = getTodayDate(timeZone)
  const from = shiftBnmDate(to, -6) ?? to
  return { from, to }
}
