import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createProxySupabaseClient } from '@/lib/supabase-server'

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

const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Edge proxy — sets security headers + refreshes the Supabase session cookie
 * + gates auth (redirects unauthenticated users to /login).
 *
 * (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; the
 * function export is also `proxy` instead of `middleware`.)
 *
 * This uses @supabase/ssr's createServerClient to read the session from
 * cookies. Unlike the previous localStorage-based approach, the session
 * cookie is readable at the edge — so we can gate auth BEFORE the page
 * renders, not after.
 *
 * In demo mode (no Supabase env vars), auth gating is skipped — the app
 * auto-logs in as a demo user client-side.
 */
export async function proxy(req: NextRequest) {
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

  // In demo mode (no Supabase configured), skip server-side auth gating.
  // The client-side AuthProvider will auto-login as the demo user.
  if (!supabaseConfigured) {
    return res
  }

  // Create a proxy-scoped Supabase client that reads + writes cookies.
  const supabase = createProxySupabaseClient(req, res)

  // Refresh the session cookie (important: getUser() triggers a token
  // refresh if the current access_token is expired, and setAll writes
  // the refreshed tokens back to the response cookies).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session → redirect to /login with the original path for post-login redirect.
  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
