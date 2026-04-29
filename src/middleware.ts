import { type NextRequest, NextResponse } from 'next/server'

// Better Auth sets `better-auth.session_token` cookie when authenticated.
// This middleware does a lightweight cookie presence check — actual session
// validation happens server-side via `getCurrentSession()` in layouts and
// pages. Middleware here is a fast first gate; defense in depth.
const SESSION_COOKIE_NAMES = ['better-auth.session_token', '__Secure-better-auth.session_token']

const PROTECTED_PREFIXES = ['/dashboard', '/settings']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const requiresAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  if (!requiresAuth) return NextResponse.next()

  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name))
  if (hasSession) return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
}
