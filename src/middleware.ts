import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.twilio.com",
    "frame-ancestors 'none'",
  ].join('; '),
}

/**
 * Edge middleware — checks Supabase session cookie and redirects
 * unauthenticated users to /login. Sets security headers on all responses.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Set all security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }

  const { pathname } = req.nextUrl

  // Skip auth check for: /login, /api/*, /_next/*, public assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/logo.svg'
  ) {
    return res
  }

  // Check for Supabase session cookie
  const hasSession = req.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

  if (supabaseConfigured && !hasSession) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
