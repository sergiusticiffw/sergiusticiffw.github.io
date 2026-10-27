import { NextRequest } from 'next/server'

import {
  isConvertCurrency,
  parseAmountToken,
  sendConvertMessage,
} from '@/server/bot/convert'
import { BNM_DATE_REGEX } from '@/server/bot/dateRatesReply'
import { verifyChatId } from '@/server/bot/sign'

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * POST /api/bot/convert
 * Body: { amount: string | number, currency: "MDL"|"USD"|"EUR", date?: "DD.MM.YYYY", chatId: number, token: string }
 *
 * Called by the convert Mini App form.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { amount: amountRaw, currency, date, chatId, token } = body ?? {}

  const amount =
    typeof amountRaw === 'number'
      ? amountRaw > 0 && Number.isFinite(amountRaw)
        ? amountRaw
        : null
      : typeof amountRaw === 'string'
        ? parseAmountToken(amountRaw)
        : null

  if (amount == null) {
    return Response.json({ ok: false, error: 'Invalid amount.' }, { status: 400 })
  }

  if (!isConvertCurrency(currency)) {
    return Response.json({ ok: false, error: 'Currency must be MDL, USD, or EUR.' }, { status: 400 })
  }

  if (date != null && (typeof date !== 'string' || !BNM_DATE_REGEX.test(date))) {
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
    await sendConvertMessage({
      botToken,
      chatId,
      amount,
      currency,
      bnmDate: typeof date === 'string' ? date : undefined,
    })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[convert] sendConvertMessage failed', err)
    return Response.json({ ok: false, error: 'Failed to convert. Try /convert in chat.' }, { status: 500 })
  }
}
