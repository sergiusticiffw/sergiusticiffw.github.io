import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOGIN_PATH = '/admin/login'

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Protect only the Loans pages (actual app routes)
  if (!pathname.startsWith('/loans')) return NextResponse.next()

  const token = req.cookies.get('payload-token')?.value
  if (token) return NextResponse.next()

  const redirectUrl = req.nextUrl.clone()
  redirectUrl.pathname = LOGIN_PATH
  redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)

  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: ['/loans', '/loans/:path*'],
}

