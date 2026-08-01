import { NextRequest, NextResponse } from 'next/server'

// ─── Simple in-memory rate limiter ──────────────────────────────────────────
// Per-IP token bucket: 60 requests per minute (1 per second burst).
// In production, replace with Upstash Redis for distributed rate limiting.

interface Bucket {
  tokens: number
  lastRefill: number
}

const RATE_LIMIT = 60 // requests per minute
const RATE_WINDOW = 60_000 // 1 minute in ms
const buckets = new Map<string, Bucket>()

// Clean up old buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > RATE_WINDOW * 5) {
      buckets.delete(key)
    }
  }
}, 300_000)

/**
 * Check rate limit for a request. Returns null if allowed, or a 429 response.
 */
export function checkRateLimit(req: NextRequest): NextResponse | null {
  // Get client IP from headers (Vercel sets these) or fall back to a default
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const now = Date.now()
  let bucket = buckets.get(ip)

  if (!bucket) {
    bucket = { tokens: RATE_LIMIT, lastRefill: now }
    buckets.set(ip, bucket)
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.lastRefill
  const refill = Math.floor((elapsed / RATE_WINDOW) * RATE_LIMIT)
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill)
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Too many requests. Please try again in a minute.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(RATE_LIMIT),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  bucket.tokens--
  return null
}
