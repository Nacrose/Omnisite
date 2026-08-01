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
 * Edge middleware — sets security headers on all responses.
 *
 * Auth gating is handled client-side in the (workspace) layout, which reads
 * the Supabase auth state directly (persisted to localStorage by the
 * @supabase/supabase-js client). The previous cookie-based middleware check
 * caused a login loop because the client-side Supabase SDK uses localStorage,
 * not cookies — so the middleware always saw "no session" and redirected to
 * /login even after a successful sign-in.
 *
 * To add server-side auth gating (for SSR/SSG protection), migrate to
 * @supabase/ssr which manages cookies properly for server-side reads.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Set all security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }

  return res
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
