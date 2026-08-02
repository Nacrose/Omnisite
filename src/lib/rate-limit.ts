import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ─── Rate limiter ───────────────────────────────────────────────────────────
// Uses Upstash Redis with a sliding-window algorithm via @upstash/ratelimit.
//
// Redis is OPTIONAL — the README documents Upstash as "for rate limiting" and
// the demo-mode setup explicitly skips it. When the env vars are missing,
// `checkRateLimit` fails OPEN (returns null, allowing the request through)
// rather than throwing an unhandled error on every API call. Rate limiting
// cannot be enforced correctly in serverless / multi-instance environments
// without shared state, so we'd rather run unprotected than break every
// request.

const RATE_LIMIT = 60 // requests per 1 minute

let redis: Redis | null = null
let ratelimit: Ratelimit | null = null

// ─── Fail-open logging ──────────────────────────────────────────────────────
// Rate limiting is optional (see README), so `checkRateLimit` fails OPEN when
// Redis isn't configured or errors at runtime. That's safe but silent — in
// production this could mean rate limiting quietly stops working with zero
// signal. `logFailOpen` emits a single `console.warn` per minute per process
// so the operator gets a signal without log spam on every request.
let lastFailOpenLog = 0
const FAIL_OPEN_LOG_INTERVAL = 60_000 // only log once per minute

function logFailOpen(reason: string) {
  const now = Date.now()
  if (now - lastFailOpenLog > FAIL_OPEN_LOG_INTERVAL) {
    console.warn(`[rate-limit] Failing open: ${reason}. Rate limiting is not active.`)
    lastFailOpenLog = now
  }
}

/**
 * Lazily build (and cache) the Ratelimit instance. Throws if Redis env vars
 * are missing — callers should guard with `isRedisConfigured()` (or use
 * `checkRateLimit`, which fails open) before invoking this directly.
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
 *
 * Fails OPEN when Redis is not configured or the limiter errors at runtime:
 * rate limiting is an optional dependency (see README) and breaking every API
 * request when Upstash is skipped would be worse than running unprotected.
 */
export async function checkRateLimit(
  req: NextRequest,
  userId?: string
): Promise<NextResponse | null> {
  // If Redis is not configured, skip rate limiting (fail-open).
  // Rate limiting is optional — the README documents Upstash as optional.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logFailOpen('Upstash Redis env vars not configured')
    return null
  }

  try {
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
  } catch (e) {
    // Redis error (connection, auth, timeout, etc.) — fail open (allow the
    // request). Logging this would require a logger available in this module;
    // for now we silently degrade. The 429 path above is preserved for the
    // normal rate-limited case.
    logFailOpen('Redis error: ' + (e instanceof Error ? e.message : String(e)))
    return null
  }
}
