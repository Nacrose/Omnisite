import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// ─── Rate limiter ───────────────────────────────────────────────────────────
// Uses Upstash Redis when configured (distributed, works across serverless
// instances). Falls back to in-memory when UPSTASH_REDIS_REST_URL is not set.

interface Bucket {
  tokens: number
  lastRefill: number
}

const RATE_LIMIT = 60 // requests per minute
const RATE_WINDOW = 60_000 // 1 minute in ms

// In-memory fallback
const buckets = new Map<string, Bucket>()
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > RATE_WINDOW * 5) buckets.delete(key)
  }
}, 300_000)

// Lazy-init Redis client (only when env vars are present)
let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

/**
 * Check rate limit for a request. Keys on user.id (from auth) when available,
 * falls back to IP address. Returns null if allowed, or a 429 response.
 */
export async function checkRateLimit(req: NextRequest, userId?: string): Promise<NextResponse | null> {
  // Key on user.id if available, otherwise IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const key = userId ? `ratelimit:${userId}` : `ratelimit:${ip}`

  const r = getRedis()
  if (r) {
    // ─── Redis path (distributed) ────────────────────────────────────────
    const now = Date.now()
    const bucketKey = `bucket:${key}`
    const data = await r.get<{ tokens: number; lastRefill: number }>(bucketKey)

    let bucket: Bucket
    if (data) {
      bucket = data
      const elapsed = now - bucket.lastRefill
      const refill = Math.floor((elapsed / RATE_WINDOW) * RATE_LIMIT)
      if (refill > 0) {
        bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill)
        bucket.lastRefill = now
      }
    } else {
      bucket = { tokens: RATE_LIMIT, lastRefill: now }
    }

    if (bucket.tokens <= 0) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Too many requests. Please try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Limit': String(RATE_LIMIT), 'X-RateLimit-Remaining': '0' } },
      )
    }

    bucket.tokens--
    // Set with 2-minute TTL so stale keys auto-expire
    await r.set(bucketKey, bucket, { ex: 120 })
    return null
  }

  // ─── In-memory fallback (single server) ──────────────────────────────────
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT, lastRefill: now }
    buckets.set(key, bucket)
  }
  const elapsed = now - bucket.lastRefill
  const refill = Math.floor((elapsed / RATE_WINDOW) * RATE_LIMIT)
  if (refill > 0) {
    bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + refill)
    bucket.lastRefill = now
  }
  if (bucket.tokens <= 0) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Too many requests. Please try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Limit': String(RATE_LIMIT), 'X-RateLimit-Remaining': '0' } },
    )
  }
  bucket.tokens--
  return null
}
