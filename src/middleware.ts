import { NextRequest, NextResponse } from 'next/server'

/**
 * Edge middleware — applies a baseline set of security headers to every
 * response (including static assets and API routes). The `headers()` config
 * in next.config.ts covers most cases, but middleware runs on the hot path
 * and ensures headers are present even on streamed / dynamically generated
 * responses where the config-based approach can be bypassed.
 */
export function middleware() {
  const res = NextResponse.next()
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  return res
}

export const config = { matcher: '/(.*)' }
