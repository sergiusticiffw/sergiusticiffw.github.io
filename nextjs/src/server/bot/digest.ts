import { defaultLastWeekRange, fetchRatesForRange, type WeekRatePoint } from '@/server/bot/weekChart'
import { sendTelegramMessage } from '@/server/bot/telegram'

type CurrencyKey = 'usd' | 'eur'

type CurrencyStats = {
  min: number
  minDate: string
  max: number
  maxDate: string
  first: number
  firstDate: string
  last: number
  lastDate: string
  delta: number
  deltaPct: number
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function formatRate(n: number): string {
  return n.toFixed(4)
}

function summarizeCurrency(points: WeekRatePoint[], key: CurrencyKey): CurrencyStats | null {
  const series = points
    .map((p) => {
      const value = p[key]
      return value == null ? null : { date: p.date, value }
    })
    .filter((x): x is { date: string; value: number } => x != null)

  if (series.length === 0) return null

  let min = series[0]
  let max = series[0]
  for (const point of series) {
    if (point.value < min.value) min = point
    if (point.value > max.value) max = point
  }

  const first = series[0]
  const last = series[series.length - 1]
  const delta = round4(last.value - first.value)
  const deltaPct = first.value === 0 ? 0 : round4((delta / first.value) * 100)

  return {
    min: min.value,
    minDate: min.date,
    max: max.value,
    maxDate: max.date,
    first: first.value,
    firstDate: first.date,
    last: last.value,
    lastDate: last.date,
    delta,
    deltaPct,
  }
}

function formatDeltaLine(delta: number, deltaPct: number): string {
  const sign = delta > 0 ? '+' : ''
  const pctSign = deltaPct > 0 ? '+' : ''
  const emoji = delta > 0 ? '🟢' : delta < 0 ? '🔴' : '⚪'
  return `${emoji} Δ ${sign}${formatRate(delta)} (${pctSign}${deltaPct.toFixed(2)}%)`
}

function formatCurrencyBlock(label: string, stats: CurrencyStats | null): string {
  if (!stats) return `${label}\n• Not available`
  return [
    label,
    `• min ${formatRate(stats.min)} (${stats.minDate})`,
    `• max ${formatRate(stats.max)} (${stats.maxDate})`,
    `• ${formatRate(stats.first)} → ${formatRate(stats.last)}`,
    `• ${formatDeltaLine(stats.delta, stats.deltaPct)}`,
  ].join('\n')
}

export function formatDigestMessage(points: WeekRatePoint[], from: string, to: string): string {
  const usd = summarizeCurrency(points, 'usd')
  const eur = summarizeCurrency(points, 'eur')

  return [
    `📊 Digest BNM — ${from} → ${to}`,
    '',
    formatCurrencyBlock('USD', usd),
    '',
    formatCurrencyBlock('EUR', eur),
  ].join('\n')
}

export async function sendDigestMessage({
  botToken,
  chatId,
}: {
  botToken: string
  chatId: number
}): Promise<void> {
  const { from, to } = defaultLastWeekRange()
  const points = await fetchRatesForRange(from, to)
  const hasAny = points.some((p) => p.usd != null || p.eur != null)

  if (!hasAny) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text: 'Could not fetch BNM rates for the last 7 days. Try again later.',
    })
    return
  }

  await sendTelegramMessage({
    botToken,
    chatId,
    text: formatDigestMessage(points, from, to),
  })
}
