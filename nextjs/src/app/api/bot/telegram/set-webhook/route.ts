import { NextRequest } from 'next/server'

import { setTelegramWebhook } from '@/server/bot/telegram'

/** Telegram acceptă setWebhook doar prin POST (JSON); nu folosi GET în browser la api.telegram.org. */

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function getOrigin(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('host')
  if (!host) return `${proto}://localhost:3000`
  return `${proto}://${host}`
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.BOT_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })

  const incoming =
    req.headers.get('x-bot-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (incoming !== secret) return new Response('Unauthorized', { status: 401 })

  const botToken = requireEnv('BOT_TOKEN')
  const hookSecret = process.env.BOT_SECRET

  const origin = getOrigin(req)
  const webhookUrl = `${origin}/api/bot/telegram/webhook`

  await setTelegramWebhook({ botToken, url: webhookUrl, secretToken: hookSecret })
  return Response.json({ ok: true, webhookUrl })
}

