import { NextRequest } from 'next/server'

import { addSubscriber } from '@/server/bot/kvSubscribers'
import { formatDailyMessage, formatHelp, isStartCommand, parseCommand } from '@/server/bot/commands'
import { BNM_DATE_REGEX, sendDateRatesMessage } from '@/server/bot/dateRatesReply'
import { fetchBnmUsdRateForDate } from '@/server/bot/bnm'
import { fetchDxyForDate, fetchDxyValue } from '@/server/bot/dxy'
import { getTodayDate, getTomorrowDate, getYesterdayDate } from '@/server/bot/date'
import { getTelegramDatePickerUrl } from '@/server/bot/publicSiteUrl'
import { isSubscribeChatType } from '@/server/bot/chatTypes'
import {
  getMessageLikeFromUpdate,
  normalizeChatId,
  sendTelegramMessage,
  type ReplyMarkup,
} from '@/server/bot/telegram'

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const BTN_TODAY = '📊 Today'
const BTN_TOMORROW = '📊 Tomorrow'
const BTN_YESTERDAY = '📊 Yesterday'
const BTN_DATE = '📅 Pick a date'
const BTN_HELP = '❓ Help'

function buildMainKeyboard(): ReplyMarkup {
  const webAppUrl = getTelegramDatePickerUrl()
  const dateBtn = webAppUrl
    ? { text: BTN_DATE, web_app: { url: webAppUrl } }
    : { text: BTN_DATE }

  return {
    keyboard: [
      [{ text: BTN_TODAY }, { text: BTN_TOMORROW }],
      [{ text: BTN_YESTERDAY }, dateBtn],
      [{ text: BTN_HELP }],
    ],
    resize_keyboard: true,
  }
}

function matchButton(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const t = text.trim()
  if (t === BTN_TODAY) return '/today'
  if (t === BTN_TOMORROW) return '/tomorrow'
  if (t === BTN_YESTERDAY) return '/yesterday'
  if (t === BTN_DATE) return '/date'
  if (t === BTN_HELP) return '/help'
  return null
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const secret = process.env.BOT_SECRET
    if (!secret) return new Response('Webhook not configured', { status: 503 })

    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (incomingSecret !== secret) return new Response('Unauthorized', { status: 401 })

    const botToken = requireEnv('BOT_TOKEN')

    let update: any
    try {
      update = await req.json()
    } catch {
      console.error('[telegram webhook] invalid JSON')
      return Response.json({ ok: true })
    }

    const updateId = update?.update_id ?? '?'
    const chatId_ = update?.message?.chat?.id ?? update?.edited_message?.chat?.id ?? '?'
    const msgText = update?.message?.text
    const hasWebAppData = Boolean(update?.message?.web_app_data)
    console.log(
      `[telegram webhook] update_id=${updateId} chat=${chatId_}`,
      hasWebAppData ? 'web_app_data' : msgText ? `text=${msgText.slice(0, 60)}` : 'no-text',
    )
    if (hasWebAppData) {
      console.log('[telegram webhook] web_app_data payload:', JSON.stringify(update.message.web_app_data))
    }

    const directMessage = update?.message
    const directChatId = normalizeChatId(directMessage?.chat?.id)
    const directWebAppData = directMessage?.web_app_data?.data
    if (directChatId && typeof directWebAppData === 'string' && directWebAppData.trim()) {
      const bnmDate = directWebAppData.trim()
      console.log(`[telegram webhook] web_app_data received: "${bnmDate}" chat=${directChatId}`)

      if (!BNM_DATE_REGEX.test(bnmDate)) {
        await sendTelegramMessage({
          botToken,
          chatId: directChatId,
          text: `Invalid date format: "${bnmDate}". Expected DD.MM.YYYY.`,
          replyMarkup: buildMainKeyboard(),
        }).catch((err) => console.error('[telegram webhook] sendMessage failed', err))
        return Response.json({ ok: true })
      }

      try {
        await sendDateRatesMessage({ botToken, chatId: directChatId, bnmDate, source: 'web_app' })
      } catch (err) {
        console.error('[telegram webhook] sendDateRatesMessage failed', err)
        await sendTelegramMessage({
          botToken,
          chatId: directChatId,
          text: `✅ Date picked: ${bnmDate}\n\nCould not fetch rates. Try /date ${bnmDate}`,
          replyMarkup: buildMainKeyboard(),
        }).catch(() => {})
      }

      return Response.json({ ok: true })
    }

    const msg = getMessageLikeFromUpdate(update)
    const chatId = normalizeChatId(msg?.chat?.id)
    if (!chatId) return Response.json({ ok: true })

    const chatType = msg?.chat?.type
    const text = msg?.text

    const buttonCmd = matchButton(text)
    const parsed = buttonCmd ? { cmd: buttonCmd, arg: '' } : parseCommand(text)

    if (!parsed && !isStartCommand(text)) return Response.json({ ok: true })

    const kbd = buildMainKeyboard()

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
      await sendTelegramMessage({
        botToken,
        chatId,
        text: 'Subscribed! Choose an option below or use /help.',
        replyMarkup: kbd,
      })
      return Response.json({ ok: true })
    }

    if (parsed && parsed.cmd === '/help') {
      await sendTelegramMessage({ botToken, chatId, text: formatHelp(), replyMarkup: kbd })
      return Response.json({ ok: true })
    }

    if (parsed && parsed.cmd === '/today') {
      const bnmDate = getTodayDate('Europe/Chisinau')
      const [usdRate, dxyValue] = await Promise.all([
        fetchBnmUsdRateForDate(bnmDate).catch(() => null),
        fetchDxyValue().catch(() => null),
      ])
      await sendTelegramMessage({
        botToken,
        chatId,
        text: formatDailyMessage({ bnmDate, usdRate, dxyValue }),
        replyMarkup: kbd,
      })
      return Response.json({ ok: true })
    }

    if (parsed && parsed.cmd === '/yesterday') {
      const bnmDate = getYesterdayDate('Europe/Chisinau')
      const [usdRate, dxyValue] = await Promise.all([
        fetchBnmUsdRateForDate(bnmDate).catch(() => null),
        fetchDxyValue().catch(() => null),
      ])
      await sendTelegramMessage({
        botToken,
        chatId,
        text: formatDailyMessage({ bnmDate, usdRate, dxyValue }),
        replyMarkup: kbd,
      })
      return Response.json({ ok: true })
    }

    if (parsed && parsed.cmd === '/tomorrow') {
      const bnmDate = getTomorrowDate('Europe/Chisinau')
      const [usdRate, dxyValue] = await Promise.all([
        fetchBnmUsdRateForDate(bnmDate).catch(() => null),
        fetchDxyValue().catch(() => null),
      ])
      await sendTelegramMessage({
        botToken,
        chatId,
        text: formatDailyMessage({ bnmDate, usdRate, dxyValue }),
        replyMarkup: kbd,
      })
      return Response.json({ ok: true })
    }

    if (parsed && parsed.cmd === '/date') {
      const arg = parsed.arg.trim()
      if (!arg) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Tap "📅 Pick a date" below or send /date DD.MM.YYYY:',
          replyMarkup: kbd,
        })
        return Response.json({ ok: true })
      }

      if (!BNM_DATE_REGEX.test(arg)) {
        await sendTelegramMessage({
          botToken,
          chatId,
          text: 'Invalid date format. Use: /date DD.MM.YYYY (example: /date 03.04.2026)',
          replyMarkup: kbd,
        })
        return Response.json({ ok: true })
      }

      await sendDateRatesMessage({ botToken, chatId, bnmDate: arg })
      return Response.json({ ok: true })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[telegram webhook] fatal error', err)
    return Response.json({ ok: true })
  }
}
