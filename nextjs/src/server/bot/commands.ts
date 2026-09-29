export function isStartCommand(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const t = text.trim()
  return t === '/start' || t.startsWith('/start ') || t.startsWith('/start@')
}

export function formatHelp(): string {
  return [
    'Available commands:',
    '',
    '/start - Subscribe to daily updates',
    '/help - Show this help',
    '/today - Get today’s USD and EUR (BNM) and current DXY',
    '/yesterday - Get yesterday’s USD and EUR (BNM) and current DXY',
    '/tomorrow - Get tomorrow’s USD and EUR (BNM) and current DXY',
    '/date - Open date picker (Web App), or /date DD.MM.YYYY (BNM + DXY)',
  ].join('\n')
}

export function parseCommand(text: unknown): { cmd: string; arg: string } | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return null

  const [cmdRaw, ...rest] = trimmed.split(/\s+/)
  const cmd = cmdRaw.split('@')[0].toLowerCase()
  const arg = rest.join(' ').trim()
  return { cmd, arg }
}

export function formatDatePickedHeader(bnmDate: string): string {
  return `✅ Date picked — ${bnmDate}`
}

function getLocalTime(timeZone = 'Europe/Chisinau'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function formatRateWithTrend(rate: string | null, previousRate: string | null | undefined): string {
  if (rate == null) return 'Not available yet'
  if (previousRate == null) return rate

  const current = Number(rate)
  const previous = Number(previousRate)
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return rate

  const diff = Math.round((current - previous) * 10000) / 10000
  if (diff > 0) return `${rate} 🔺 +${diff.toFixed(4)}`
  if (diff < 0) return `${rate} 🔻 ${diff.toFixed(4)}`
  return `${rate} → 0.0000`
}

export function formatDailyMessage({
  bnmDate,
  usdRate,
  eurRate,
  dxyValue,
  previousUsdRate,
  previousEurRate,
}: {
  bnmDate: string
  usdRate: string | null
  eurRate: string | null
  dxyValue: string | null
  previousUsdRate?: string | null
  previousEurRate?: string | null
}): string {
  const usdText = formatRateWithTrend(usdRate, previousUsdRate)
  const eurText = formatRateWithTrend(eurRate, previousEurRate)
  const dxyText = dxyValue ?? 'Not available yet'
  const time = getLocalTime()
  return `📊 Daily Currency Update — BNM (${bnmDate})\n\nUSD (BNM): ${usdText}\nEUR (BNM): ${eurText}\nDXY: ${dxyText}\n\n⏰ Time: ${time}`
}

