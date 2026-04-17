import { formatDailyMessage, formatDatePickedHeader } from '@/server/bot/commands'
import { fetchBnmUsdRateForDate } from '@/server/bot/bnm'
import { fetchDxyForDate, fetchDxyValue } from '@/server/bot/dxy'
import { sendTelegramMessage } from '@/server/bot/telegram'

export const BNM_DATE_REGEX = /^\d{2}\.\d{2}\.\d{4}$/

export async function sendDateRatesMessage({
  botToken,
  chatId,
  bnmDate,
  source = 'command',
}: {
  botToken: string
  chatId: number
  bnmDate: string
  source?: 'web_app' | 'command'
}): Promise<void> {
  const usdRate = await fetchBnmUsdRateForDate(bnmDate).catch(() => null)
  const dxyHistorical = await fetchDxyForDate(bnmDate).catch(() => null)
  const dxyValue = dxyHistorical ?? (await fetchDxyValue().catch(() => null))
  const body = formatDailyMessage({ bnmDate, usdRate, dxyValue })
  const text =
    source === 'web_app' ? `${formatDatePickedHeader(bnmDate)}\n\n${body}` : body
  await sendTelegramMessage({
    botToken,
    chatId,
    text,
  })
}
