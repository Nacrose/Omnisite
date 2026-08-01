import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge middleware — checks Supabase session cookie and redirects
 * unauthenticated users to /login (except on /login itself and API routes).
 *
 * Also sets security headers on all responses.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Security headers on every response
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')

  const { pathname } = req.nextUrl

  // Skip auth check for:
  // - /login (the login page itself)
  // - /api/* (API routes have their own auth via requireAuth)
  // - /_next/* (Next.js internals)
  // - /logo.svg (public asset)
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/logo.svg'
  ) {
    return res
  }

  // Check for Supabase session cookie.
  // The browser Supabase client stores the session in cookies named
  // sb-<project-ref>-auth-token. We check for any cookie starting with 'sb-'.
  const hasSession = req.cookies.getAll().some(c => c.name.startsWith('sb-'))

  // If Supabase is not configured (demo mode), allow through — the client-side
  // AuthProvider will auto-login as the demo user.
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

  if (supabaseConfigured && !hasSession) {
    // Redirect to login with the original URL as redirect param
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
