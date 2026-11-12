import { fetchLastWeekRates } from '@/server/bot/weekChart'

export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * GET /api/bot/week-rates
 * Returns BNM USD/EUR for the last 7 calendar days (Europe/Chisinau).
 */
export async function GET(): Promise<Response> {
  try {
    const points = await fetchLastWeekRates()
    return Response.json({ ok: true, points })
  } catch (err) {
    console.error('[week-rates] failed', err)
    return Response.json({ ok: false, error: 'Could not fetch week rates.' }, { status: 500 })
  }
}
