import { NextResponse } from 'next/server'

import { getServerSideURL } from '@/utilities/getURL'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email ?? '')
  const password = String(body?.password ?? '')
  const redirectTo = String(body?.redirectTo ?? '/')

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
  }

  const upstream = await fetch(`${getServerSideURL()}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  const json = await upstream.json().catch(() => null)
  if (!upstream.ok) {
    return NextResponse.json({ error: json?.errors?.[0]?.message ?? 'Login failed' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, redirectTo })
  const setCookie = upstream.headers.get('set-cookie')
  if (setCookie) res.headers.set('set-cookie', setCookie)
  return res
}
