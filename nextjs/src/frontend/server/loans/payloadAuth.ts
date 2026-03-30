import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'
import { cookies, headers as nextHeaders } from 'next/headers'
import type { NextRequest } from 'next/server'
import type { PayloadRequest } from 'payload'

export async function requireAuthedPayload(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })

  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // Payload auth expects `Authorization: JWT <token>`
  const headers = new Headers(req.headers)
  headers.set('Authorization', `JWT ${token}`)

  const user = await payload.auth({
    req: req as unknown as PayloadRequest,
    headers,
  })

  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  return payload
}

export async function requireAuthedPayloadReqFromServer() {
  const payload = await getPayload({ config: configPromise })

  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) {
    throw new Response('Unauthorized', { status: 401 })
  }

  // Payload auth expects `Authorization: JWT <token>`
  const reqHeaders = await nextHeaders()
  const headers = new Headers(reqHeaders)
  headers.set('Authorization', `JWT ${token}`)

  const { user } = await payload.auth({
    req: {} as unknown as PayloadRequest,
    headers,
  })

  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const req = await createLocalReq({ user }, payload)
  return { payload, req }
}

