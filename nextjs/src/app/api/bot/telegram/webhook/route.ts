import { NextRequest } from 'next/server'

import { addSubscriber } from '@/server/bot/kvSubscribers'
import { formatDailyMessage, formatHelp, isStartCommand, parseCommand } from '@/server/bot/commands'
import { fetchBnmUsdRateForDate } from '@/server/bot/bnm'
import { fetchDxyForDate, fetchDxyValue } from '@/server/bot/dxy'
import { getTodayDate, getTomorrowDate, getYesterdayDate } from '@/server/bot/date'
import { isSubscribeChatType } from '@/server/bot/chatTypes'
import { getMessageLikeFromUpdate, normalizeChatId, sendTelegramMessage } from '@/server/bot/telegram'

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.BOT_SECRET
  if (!secret) return new Response('Webhook not configured', { status: 503 })

  // Telegram sends this header when secret token is configured.
  const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (incomingSecret !== secret) return new Response('Unauthorized', { status: 401 })

  const botToken = requireEnv('BOT_TOKEN')

  let update: any
  try {
    update = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const msg = getMessageLikeFromUpdate(update)
  const chatId = normalizeChatId(msg?.chat?.id)
  const chatType = msg?.chat?.type
  const text = msg?.text
  if (!chatId) return Response.json({ ok: true })

  const parsed = parseCommand(text)
  if (!parsed && !isStartCommand(text)) return Response.json({ ok: true })

  if (isStartCommand(text)) {
    if (!isSubscribeChatType(chatType)) return Response.json({ ok: true })
    await addSubscriber(chatId)
    await sendTelegramMessage({ botToken, chatId, text: 'Subscribed. Use /help to see commands.' })
    return Response.json({ ok: true })
  }

  if (parsed && parsed.cmd === '/help') {
    await sendTelegramMessage({ botToken, chatId, text: formatHelp() })
    return Response.json({ ok: true })
  }

  if (parsed && parsed.cmd === '/today') {
    const bnmDate = getTodayDate('Europe/Chisinau')
    const [usdRate, dxyValue] = await Promise.all([
      fetchBnmUsdRateForDate(bnmDate).catch(() => null),
      fetchDxyValue().catch(() => null),
    ])
    await sendTelegramMessage({ botToken, chatId, text: formatDailyMessage({ bnmDate, usdRate, dxyValue }) })
    return Response.json({ ok: true })
  }

  if (parsed && parsed.cmd === '/yesterday') {
    const bnmDate = getYesterdayDate('Europe/Chisinau')
    const [usdRate, dxyValue] = await Promise.all([
      fetchBnmUsdRateForDate(bnmDate).catch(() => null),
      fetchDxyValue().catch(() => null),
    ])
    await sendTelegramMessage({ botToken, chatId, text: formatDailyMessage({ bnmDate, usdRate, dxyValue }) })
    return Response.json({ ok: true })
  }

  if (parsed && parsed.cmd === '/tomorrow') {
    const bnmDate = getTomorrowDate('Europe/Chisinau')
    const [usdRate, dxyValue] = await Promise.all([
      fetchBnmUsdRateForDate(bnmDate).catch(() => null),
      fetchDxyValue().catch(() => null),
    ])
    await sendTelegramMessage({ botToken, chatId, text: formatDailyMessage({ bnmDate, usdRate, dxyValue }) })
    return Response.json({ ok: true })
  }

  if (parsed && parsed.cmd === '/date') {
    const bnmDate = parsed.arg
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(bnmDate)) {
      await sendTelegramMessage({
        botToken,
        chatId,
        text: 'Invalid date format. Use: /date DD.MM.YYYY (example: /date 03.04.2026)',
      })
      return Response.json({ ok: true })
    }

    const usdRate = await fetchBnmUsdRateForDate(bnmDate).catch(() => null)
    const dxyHistorical = await fetchDxyForDate(bnmDate).catch(() => null)
    const dxyValue = dxyHistorical ?? (await fetchDxyValue().catch(() => null))

    await sendTelegramMessage({ botToken, chatId, text: formatDailyMessage({ bnmDate, usdRate, dxyValue }) })
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}

