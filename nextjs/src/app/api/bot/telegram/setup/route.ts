import { NextRequest } from 'next/server'

import { getTelegramDatePickerUrl } from '@/server/bot/publicSiteUrl'
import { setTelegramWebhook, setTelegramChatMenuButton } from '@/server/bot/telegram'

export const runtime = 'nodejs'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * POST /api/bot/telegram/setup
 *
 * One-time setup: registers the Telegram webhook and sets the Menu Button
 * to open the date picker Web App directly.
 *
 * Requires BOT_TOKEN, BOT_SECRET, and NEXT_PUBLIC_SERVER_URL env vars.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.BOT_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const incoming = req.headers.get('x-bot-secret') || bearer || ''
  if (incoming !== secret) return new Response('Unauthorized', { status: 401 })

  const botToken = requireEnv('BOT_TOKEN')

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim().replace(/\/$/, '')
  if (!baseUrl) {
    return Response.json(
      { ok: false, error: 'NEXT_PUBLIC_SERVER_URL is not set' },
      { status: 500 },
    )
  }

  const results: Record<string, unknown> = {}

  const webhookUrl = `${baseUrl}/api/bot/telegram/webhook`
  try {
    await setTelegramWebhook({ botToken, url: webhookUrl, secretToken: secret })
    results.webhook = { ok: true, url: webhookUrl }
  } catch (err) {
    results.webhook = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const datePickerUrl = getTelegramDatePickerUrl()
  if (datePickerUrl) {
    try {
      await setTelegramChatMenuButton({
        botToken,
        text: '📅 Date picker',
        webAppUrl: datePickerUrl,
      })
      results.menuButton = { ok: true, url: datePickerUrl }
    } catch (err) {
      results.menuButton = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  } else {
    results.menuButton = { ok: false, error: 'Date picker URL could not be built' }
  }

  const allOk = Object.values(results).every((r: any) => r.ok === true)
  return Response.json({ ok: allOk, results })
}
