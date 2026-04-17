import { NextRequest } from 'next/server'

import { addSubscriber } from '@/server/bot/kvSubscribers'
import { formatDailyMessage, formatHelp, isStartCommand, parseCommand } from '@/server/bot/commands'
import { BNM_DATE_REGEX, sendDateRatesMessage } from '@/server/bot/dateRatesReply'
import { fetchBnmUsdRateForDate } from '@/server/bot/bnm'
import { fetchDxyForDate, fetchDxyValue } from '@/server/bot/dxy'
import { getTodayDate, getTomorrowDate, getYesterdayDate } from '@/server/bot/date'
import { getTelegramDatePickerUrl } from '@/server/bot/publicSiteUrl'
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
  if (!chatId) return Response.json({ ok: true })

  const webAppData = msg?.web_app_data?.data
  if (typeof webAppData === 'string' && webAppData.trim()) {
    const bnmDate = webAppData.trim()
    if (!BNM_DATE_REGEX.test(bnmDate)) {
      await sendTelegramMessage({
        botToken,
        chatId,
        text: 'Invalid date format. Expected DD.MM.YYYY.',
      })
      return Response.json({ ok: true })
    }
    await sendDateRatesMessage({ botToken, chatId, bnmDate, source: 'web_app' })
    return Response.json({ ok: true })
  }

  const chatType = msg?.chat?.type
  const text = msg?.text

  const parsed = parseCommand(text)
  if (!parsed && !isStartCommand(text)) return Response.json({ ok: true })

  if (isStartCommand(text)) {
    if (!isSubscribeChatType(chatType)) return Response.json({ ok: true })
    try {
      await addSubscriber(chatId)
    } catch {
      await sendTelegramMessage({
        botToken,
        chatId,
        text: 'Could not save your subscription (storage error). Check server logs / KV env vars.',
      })
      return Response.json({ ok: true })
    }
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
    const arg = parsed.arg.trim()
    if (!arg) {
      const webAppUrl = getTelegramDatePickerUrl()
      if (webAppUrl) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Alege data:',
          replyMarkup: {
            inline_keyboard: [[{ text: '📅 Alege data', web_app: { url: webAppUrl } }]],
          },
        })
      } else {
        await sendTelegramMessage({
          botToken,
          chatId,
          text:
            'Date picker URL is not configured. Set NEXT_PUBLIC_SERVER_URL to your public HTTPS origin, or use: /date DD.MM.YYYY',
        })
      }
      return Response.json({ ok: true })
    }

    if (!BNM_DATE_REGEX.test(arg)) {
      await sendTelegramMessage({
        botToken,
        chatId,
        text: 'Invalid date format. Use: /date DD.MM.YYYY (example: /date 03.04.2026)',
      })
      return Response.json({ ok: true })
    }

    await sendDateRatesMessage({ botToken, chatId, bnmDate: arg })
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}
