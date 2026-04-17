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
    '/today - Get today’s USD (BNM) and current DXY',
    '/yesterday - Get yesterday’s USD (BNM) and current DXY',
    '/tomorrow - Get tomorrow’s USD (BNM) and current DXY',
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

export function formatDailyMessage({
  bnmDate,
  usdRate,
  dxyValue,
}: {
  bnmDate: string
  usdRate: string | null
  dxyValue: string | null
}): string {
  const usdText = usdRate ?? 'Not available yet'
  const dxyText = dxyValue ?? 'Not available yet'
  const time = getLocalTime()
  return `📊 Daily Currency Update — BNM (${bnmDate})\n\nUSD (BNM): ${usdText}\nDXY: ${dxyText}\n\n⏰ Time: ${time}`
}

