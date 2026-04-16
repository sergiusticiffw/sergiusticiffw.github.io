function normalizeIdText(s: unknown) {
  return String(s ?? '').trim().replace(/\u2212/g, '-')
}

export function normalizeChatId(chatId: unknown): number | null {
  if (chatId == null) return null
  const n = Number(normalizeIdText(chatId))
  return Number.isFinite(n) ? n : null
}

export function getMessageLikeFromUpdate(update: any): any | null {
  if (!update || typeof update !== 'object') return null
  return (
    update.message ??
    update.edited_message ??
    update.channel_post ??
    update.edited_channel_post ??
    null
  )
}

export async function sendTelegramMessage({
  botToken,
  chatId,
  text,
}: {
  botToken: string
  chatId: number
  text: string
}): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  const data: any = await res.json().catch(() => null)
  if (data?.ok === true) return

  const code = data?.error_code ?? res.status
  const desc = data?.description ?? res.statusText ?? 'Unknown Telegram error'
  throw new Error(`Telegram sendMessage failed for chat_id=${chatId}: [${code}] ${desc}`)
}

export async function setTelegramWebhook({
  botToken,
  url,
  secretToken,
}: {
  botToken: string
  url: string
  secretToken?: string
}): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${botToken}/setWebhook`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      ...(secretToken ? { secret_token: secretToken } : {}),
    }),
  })
  const data: any = await res.json().catch(() => null)
  if (data?.ok === true) return
  const code = data?.error_code ?? res.status
  const desc = data?.description ?? res.statusText ?? 'Unknown Telegram error'
  throw new Error(`Telegram setWebhook failed: [${code}] ${desc}`)
}
