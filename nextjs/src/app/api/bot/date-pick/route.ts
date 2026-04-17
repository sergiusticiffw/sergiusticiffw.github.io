import { NextRequest } from 'next/server'

import { verifyChatId } from '@/server/bot/sign'
import { BNM_DATE_REGEX, sendDateRatesMessage } from '@/server/bot/dateRatesReply'

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * POST /api/bot/date-pick
 * Body: { date: "DD.MM.YYYY", chatId: number, token: string }
 *
 * Called directly by the date-picker page instead of Telegram's sendData().
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { date, chatId, token } = body ?? {}

  if (typeof date !== 'string' || !BNM_DATE_REGEX.test(date)) {
    return Response.json({ ok: false, error: 'Invalid date format. Expected DD.MM.YYYY.' }, { status: 400 })
  }

  if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
    return Response.json({ ok: false, error: 'Missing or invalid chatId' }, { status: 400 })
  }

  if (typeof token !== 'string' || !verifyChatId(chatId, token)) {
    return Response.json({ ok: false, error: 'Invalid token' }, { status: 403 })
  }

  const botToken = requireEnv('BOT_TOKEN')

  try {
    await sendDateRatesMessage({ botToken, chatId, bnmDate: date, source: 'web_app' })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[date-pick] sendDateRatesMessage failed', err)
    return Response.json(
      { ok: false, error: 'Failed to send rates. Try /date ' + date },
      { status: 500 },
    )
  }
}
