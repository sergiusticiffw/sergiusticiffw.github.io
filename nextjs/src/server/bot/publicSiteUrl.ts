/**
 * Public HTTPS base URL for Web App buttons (Telegram requires absolute URL).
 * In @BotFather, add this domain under the bot’s Web App / Mini App settings so the button opens.
 */
export function getPublicSiteBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SERVER_URL?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, '')
  if (vercel) return vercel.startsWith('http') ? vercel : `https://${vercel}`
  return ''
}

export function getTelegramDatePickerUrl(): string {
  const base = getPublicSiteBaseUrl()
  if (!base) return ''
  return `${base}/date-picker`
}
