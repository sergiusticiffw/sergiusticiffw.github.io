import { NextRequest } from 'next/server'

import {
  defaultLastWeekRange,
  fetchRatesForRange,
  MAX_RANGE_DAYS,
  validateRateRange,
} from '@/server/bot/weekChart'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * GET /api/bot/week-rates?from=DD.MM.YYYY&to=DD.MM.YYYY
 * Without params → last 7 calendar days (Europe/Chisinau).
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')

    let from: string
    let to: string

    if (fromParam == null && toParam == null) {
      const defaults = defaultLastWeekRange()
      from = defaults.from
      to = defaults.to
    } else if (fromParam == null || toParam == null) {
      return Response.json(
        { ok: false, error: 'Provide both from and to as DD.MM.YYYY, or omit both.' },
        { status: 400 },
      )
    } else {
      from = fromParam.trim()
      to = toParam.trim()
    }

    const validated = validateRateRange(from, to)
    if (!validated.ok) {
      const message =
        validated.error === 'from_after_to'
          ? 'from must be on or before to.'
          : validated.error === 'too_long'
            ? `Range too long. Maximum is ${MAX_RANGE_DAYS} days.`
            : 'Invalid date format. Expected DD.MM.YYYY.'
      return Response.json({ ok: false, error: message }, { status: 400 })
    }

    const points = await fetchRatesForRange(from, to)
    return Response.json({ ok: true, points, from, to })
  } catch (err) {
    console.error('[week-rates] failed', err)
    return Response.json({ ok: false, error: 'Could not fetch week rates.' }, { status: 500 })
  }
}
