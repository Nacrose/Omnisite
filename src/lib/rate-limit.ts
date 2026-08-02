import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ─── Rate limiter ───────────────────────────────────────────────────────────
// Uses Upstash Redis with a sliding-window algorithm via @upstash/ratelimit.
//
// Redis is REQUIRED — there is no in-memory fallback. Rate limiting cannot be
// enforced correctly in serverless / multi-instance environments without
// shared state, so a missing Redis configuration is treated as a hard error
// (getRatelimit throws) rather than silently allowing all traffic through.

const RATE_LIMIT = 60 // requests per 1 minute

let redis: Redis | null = null
let ratelimit: Ratelimit | null = null

/**
 * Lazily build (and cache) the Ratelimit instance. Throws if Redis env vars
 * are missing — callers (the API routes) will surface the 500.
 */
function getRatelimit(): Ratelimit {
  if (ratelimit) return ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set — rate limiting requires Redis.'
    )
  }
  redis = new Redis({ url, token })
  ratelimit = new Ratelimit({
    redis,
    // Sliding window: 60 requests per 1 minute per identifier.
    limiter: Ratelimit.slidingWindow(RATE_LIMIT, '1 m'),
    prefix: 'omnisite:ratelimit',
    analytics: false,
  })
  return ratelimit
}

/**
 * Resolve the client identifier for rate-limiting purposes.
 *
 * Prefers the authenticated user's id; otherwise falls back to IP. The
 * `x-forwarded-for` header is only trusted when `TRUST_PROXY=true` is set
 * (e.g. behind Caddy/Nginx). Without that flag we deliberately ignore it
 * to prevent trivial spoofing.
 */
function resolveIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return userId
  if (process.env.TRUST_PROXY === 'true') {
    const xff = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (xff) return `ip:${xff}`
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return 'anonymous'
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return `ip:${realIp}`
  return 'anonymous-unauth'
}

/**
 * Check rate limit for a request. Keys on user.id (from auth) when available,
 * falls back to IP address. Returns null if allowed, or a 429 response.
 */
export async function checkRateLimit(
  req: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  const identifier = resolveIdentifier(req, userId)
  const limiter = getRatelimit()

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    // `reset` is a unix timestamp (ms) for the sliding window; derive a
    // sensible Retry-After value in seconds, capped to the window length.
    const retryAfter = Math.max(1, Math.min(60, Math.ceil((reset - Date.now()) / 1000)))
    return NextResponse.json(
      { error: 'Rate limit exceeded. Too many requests. Please try again in a minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  return null
}
