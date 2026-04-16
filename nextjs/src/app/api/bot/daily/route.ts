import { NextRequest } from 'next/server'

import { formatDailyMessage } from '@/server/bot/commands'
import { fetchBnmUsdRateForDate } from '@/server/bot/bnm'
import { fetchDxyValue } from '@/server/bot/dxy'
import { getTomorrowDate } from '@/server/bot/date'
import { parseChatIdsFromEnv } from '@/server/bot/chatIdsEnv'
import { listSubscribers, removeSubscriber } from '@/server/bot/kvSubscribers'
import { sendTelegramMessage } from '@/server/bot/telegram'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Daily send: “tomorrow” BNM date for Europe/Chisinau.
 *
 * Cron: `15 14 * * *` = 14:15 UTC (ora din vercel.json).
 * La Chișinău: 14:15 UTC + 2h = 16:15 când fusul e UTC+2 (EET, ora de iarnă).
 * Când fusul e UTC+3 (EEST, ora de vară), aceeași oră UTC = 17:15 locală.
 * Pentru 16:15 locală la UTC+3, folosește `15 13 * * *` (13:15 UTC).
 */

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handler(req: NextRequest): Promise<Response> {
  const url = new URL(req.url)
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  const cronSecret = process.env.CRON_SECRET
  const botSecret = process.env.BOT_SECRET

  let authorized = false
  if (cronSecret && bearer === cronSecret) {
    authorized = true
  } else if (botSecret) {
    const incoming =
      req.headers.get('x-bot-secret') || bearer || url.searchParams.get('secret') || ''
    if (incoming === botSecret) authorized = true
  }

  if (!authorized) {
    if (!cronSecret && !botSecret) return new Response('Daily endpoint not configured', { status: 503 })
    return new Response('Unauthorized', { status: 401 })
  }

  const botToken = requireEnv('BOT_TOKEN')
  const timeZone = 'Europe/Chisinau'

  const bnmDate = getTomorrowDate(timeZone)

  const [usdRate, dxyValue] = await Promise.all([fetchBnmUsdRateForDate(bnmDate).catch(() => null), fetchDxyValue().catch(() => null)])
  const text = formatDailyMessage({ bnmDate, usdRate, dxyValue })

  const kvSubscribers = await listSubscribers().catch(() => [])
  const envRecipients = parseChatIdsFromEnv(process.env.CHAT_IDS)
  const recipients = Array.from(new Set([...kvSubscribers, ...envRecipients]))

  if (recipients.length === 0) return Response.json({ ok: true, message: 'No recipients' })

  let sent = 0
  let failed = 0
  const failures: { chatId: number; error: string }[] = []

  for (let i = 0; i < recipients.length; i += 1) {
    const chatId = recipients[i]
    try {
      await sendTelegramMessage({ botToken, chatId, text })
      sent += 1
    } catch (err) {
      failed += 1
      const msg = String((err as any)?.message ?? err)
      failures.push({ chatId, error: msg })
      const lower = msg.toLowerCase()

      if (lower.includes('bot was blocked') || lower.includes('forbidden') || lower.includes('chat not found')) {
        await removeSubscriber(chatId).catch(() => undefined)
      }
    }

    if (i + 1 < recipients.length) await sleep(250)
  }

  return Response.json({
    ok: failed === 0,
    sent,
    failed,
    failures: failures.slice(0, 50),
  })
}

export async function GET(req: NextRequest): Promise<Response> {
  return handler(req)
}

export async function POST(req: NextRequest): Promise<Response> {
  return handler(req)
}
