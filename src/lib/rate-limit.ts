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
// AND (if Sentry is configured) captures a single Sentry event with a dedup
// key, so operators get paged instead of finding out from a postmortem.
let lastFailOpenLog = 0
let lastFailOpenSentryEvent = 0
const FAIL_OPEN_LOG_INTERVAL = 60_000 // only log once per minute
const FAIL_OPEN_SENTRY_INTERVAL = 5 * 60_000 // Sentry event at most once per 5 min per process

async function logFailOpen(reason: string) {
  const now = Date.now()
  if (now - lastFailOpenLog > FAIL_OPEN_LOG_INTERVAL) {
    console.warn(`[rate-limit] Failing open: ${reason}. Rate limiting is not active.`)
    lastFailOpenLog = now
  }

  // Emit a Sentry event (dedup'd) so operators get paged. Imported lazily to
  // avoid pulling Sentry into the client bundle and to keep this no-op when
  // Sentry isn't configured.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && now - lastFailOpenSentryEvent > FAIL_OPEN_SENTRY_INTERVAL) {
    lastFailOpenSentryEvent = now
    try {
      const { Sentry } = await import('./sentry')
      Sentry.captureMessage(`Rate limiter failing open: ${reason}`, {
        level: 'warning',
        tags: { component: 'rate-limit', fail_open: 'true' },
      })
    } catch {
      // Sentry not initialized — swallow, the console.warn above is the
      // fallback signal.
    }
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
 * `x-forwarded-for` header is trusted when `TRUST_PROXY=true` is set
 * (e.g. behind Caddy/Nginx) OR when running on Vercel (auto-detected via
 * `process.env.VERCEL === '1'`). Without that flag we deliberately ignore it
 * to prevent trivial spoofing.
 */
function resolveIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return userId
  // Vercel always sits behind a proxy that sets x-forwarded-for correctly.
  // Auto-trust it so rate limiting works out-of-the-box without forcing the
  // operator to set TRUST_PROXY=true in their Vercel env vars.
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.VERCEL === '1'
  if (trustProxy) {
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
    void logFailOpen('Upstash Redis env vars not configured')
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
    // request). `logFailOpen` emits both a console.warn and a Sentry event
    // (dedup'd) so operators get paged instead of finding out from a
    // postmortem. The 429 path above is preserved for the normal
    // rate-limited case.
    void logFailOpen('Redis error: ' + (e instanceof Error ? e.message : String(e)))
    return null
  }
}
