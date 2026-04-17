import { NextRequest } from 'next/server'

import { getTelegramDatePickerUrl } from '@/server/bot/publicSiteUrl'
import { setTelegramChatMenuButton } from '@/server/bot/telegram'

export const runtime = 'nodejs'
export const maxDuration = 20

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.BOT_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })

  const incoming =
    req.headers.get('x-bot-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (incoming !== secret) return new Response('Unauthorized', { status: 401 })

  const webAppUrl = getTelegramDatePickerUrl()
  if (!webAppUrl) {
    return Response.json(
      {
        ok: false,
        error:
          'Lipsește URL-ul public. Setează NEXT_PUBLIC_SERVER_URL (sau VERCEL_URL) pentru /date-picker.',
      },
      { status: 400 },
    )
  }

  const botToken = requireEnv('BOT_TOKEN')
  await setTelegramChatMenuButton({
    botToken,
    text: 'Alege data',
    webAppUrl,
  })

  return Response.json({ ok: true, webAppUrl })
}
