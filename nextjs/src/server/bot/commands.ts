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
    '/date DD.MM.YYYY - Get USD (BNM) + DXY for a specific date (best-effort for DXY)',
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
  return `📊 Daily Currency Update — BNM (${bnmDate})\n\nUSD (BNM): ${usdText}\nDXY: ${dxyText}\n\n⏰ Time: 16:15`
}

