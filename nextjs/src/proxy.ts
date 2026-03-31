import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOGIN_PATH = '/login'

function base64UrlToString(input: string) {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  // atob is available in the Edge runtime
  return atob(base64)
}

function getJwtPayload(token: string): any | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(base64UrlToString(parts[1]))
  } catch {
    return null
  }
}

function tokenHasAdminRole(token: string | undefined): boolean {
  if (!token) return false
  const payload = getJwtPayload(token)
  const roles = payload?.roles
  return Array.isArray(roles) && roles.includes('admin')
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  const token = req.cookies.get('payload-token')?.value

  // Server-side redirect: non-admins should never land in `/admin/*`
  if (pathname.startsWith('/admin')) {
    if (token && !tokenHasAdminRole(token)) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Protect Loans pages: require auth cookie
  if (!(pathname === '/' || pathname.startsWith('/loans'))) return NextResponse.next()
  if (token) return NextResponse.next()

  const redirectUrl = req.nextUrl.clone()
  redirectUrl.pathname = LOGIN_PATH
  redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)

  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: ['/', '/loans', '/loans/:path*', '/admin', '/admin/:path*'],
}
