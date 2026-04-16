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

function localTimeHHMM(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hh}:${mm}`
}

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

  const secret = process.env.BOT_SECRET
  if (!secret) return new Response('Daily endpoint not configured', { status: 503 })

  const incoming =
    req.headers.get('x-bot-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    url.searchParams.get('secret') ||
    ''
  if (incoming !== secret) return new Response('Unauthorized', { status: 401 })

  const botToken = requireEnv('BOT_TOKEN')

  const timeZone = 'Europe/Chisinau'

  // Vercel Cron runs in UTC; we schedule both 13:15 and 14:15 UTC and only execute
  // when local time in Europe/Chisinau is exactly 16:15.
  const isCron = url.searchParams.get('cron') === '1'
  if (isCron) {
    const hhmm = localTimeHHMM(timeZone)
    if (hhmm !== '16:15') {
      return Response.json({ ok: true, skipped: true, reason: `local_time=${hhmm}` })
    }
  }

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

