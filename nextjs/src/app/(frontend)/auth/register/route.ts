import { NextResponse } from 'next/server'

import { getServerSideURL } from '@/utilities/getURL'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '')
  const email = String(body?.email ?? '')
  const password = String(body?.password ?? '')
  const redirectTo = String(body?.redirectTo ?? '/')

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 })
  }

  // Create user via Payload REST API (honors collection access control).
  const createRes = await fetch(`${getServerSideURL()}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
    cache: 'no-store',
  })

  const created = await createRes.json().catch(() => null)
  if (!createRes.ok) {
    return NextResponse.json({ error: created?.errors?.[0]?.message ?? 'Registration failed' }, { status: 400 })
  }

  // Immediately login to set the httpOnly cookie.
  const loginRes = await fetch(`${getServerSideURL()}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  const loginJson = await loginRes.json().catch(() => null)
  if (!loginRes.ok) {
    return NextResponse.json({ error: loginJson?.errors?.[0]?.message ?? 'Login failed' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, redirectTo })
  const setCookie = loginRes.headers.get('set-cookie')
  if (setCookie) res.headers.set('set-cookie', setCookie)
  return res
}

