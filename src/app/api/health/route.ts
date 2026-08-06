import { NextResponse } from 'next/server'
import { isServerSupabaseConfigured, supabase } from '@/lib/supabase-server'

/**
 * Health check endpoint — `/api/health`.
 *
 * Public (no auth) so uptime monitors (UptimeRobot, Better Stack, Vercel's
 * built-in healthCheckPath) can probe it without a session. Returns 503 if
 * any critical dependency is unreachable, 200 otherwise.
 *
 * Reports the reachability of:
 *   - Supabase (DB + Auth) — a tiny SELECT against the projects table
 *     (RLS-gated, so an unauthenticated call returns [] — still proves
 *     the round-trip works)
 *   - Upstash Redis — reported as "configured: true/false" without a
 *     network ping (rate limiting is optional; a deeper ping would pull
 *     @upstash/redis into the health check bundle)
 *
 * Response shape:
 *   {
 *     "status": "ok" | "degraded" | "down",
 *     "timestamp": "2026-08-06T07:30:00.000Z",
 *     "commit": "<git sha, if set>",
 *     "durationMs": 47,
 *     "checks": {
 *       "supabase": { "configured": true, "reachable": true, "latencyMs": 47 },
 *       "redis": { "configured": false }
 *     },
 *     "env": {
 *       "NEXT_PUBLIC_SUPABASE_URL": true,
 *       "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
 *       "SUPABASE_SERVICE_ROLE_KEY": true,
 *       "UPSTASH_REDIS_REST_URL": false,
 *       "UPSTASH_REDIS_REST_TOKEN": false,
 *       "NEXT_PUBLIC_SENTRY_DSN": false
 *     }
 *   }
 *
 * Latency budget: ~200ms (Supabase round-trip). Wrapped in a 1.5s
 * AbortController timeout so the endpoint never hangs the uptime monitor.
 */

export const dynamic = 'force-dynamic' // always fresh, never cached

interface CheckResult {
  configured: boolean
  reachable?: boolean
  latencyMs?: number
  error?: string
}

export async function GET() {
  const start = Date.now()
  const timestamp = new Date().toISOString()

  // ─── Supabase check ──────────────────────────────────────────────────────
  // .from('projects').select('id').limit(1) is RLS-gated; an unauthenticated
  // call returns { data: [], error: null } (not an exception) — that still
  // proves the round-trip works. A network error (DNS, TLS, timeout) is the
  // failure signal.
  const supabaseCheck: CheckResult = await (async () => {
    if (!isServerSupabaseConfigured()) return { configured: false }
    const t0 = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1500)
      await supabase.from('projects').select('id').limit(1).abortSignal(controller.signal)
      clearTimeout(timeout)
      return { configured: true, reachable: true, latencyMs: Date.now() - t0 }
    } catch (e) {
      return {
        configured: true,
        reachable: false,
        latencyMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  })()

  // ─── Redis check ─────────────────────────────────────────────────────────
  // Rate limiting is optional (fail-open). We just report whether the env
  // vars are set; a deeper ping would require importing @upstash/redis
  // here, which would pull the lib into the health check bundle.
  const redisConfigured =
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN

  // ─── Aggregate ───────────────────────────────────────────────────────────
  //   "ok"       — Supabase reachable (Redis is optional)
  //   "degraded" — Supabase reachable but Redis not configured (rate
  //                limiting fails open, so the app still works)
  //   "down"     — Supabase unreachable (every write will 500)
  const supabaseOk = supabaseCheck.configured && supabaseCheck.reachable === true
  const status: 'ok' | 'degraded' | 'down' = !supabaseOk
    ? 'down'
    : !redisConfigured
      ? 'degraded'
      : 'ok'

  const httpStatus = status === 'down' ? 503 : 200

  return NextResponse.json(
    {
      status,
      timestamp,
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      durationMs: Date.now() - start,
      checks: {
        supabase: supabaseCheck,
        redis: redisConfigured ? { configured: true } : { configured: false },
      },
      env: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        NEXT_PUBLIC_SENTRY_DSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      },
    },
    { status: httpStatus }
  )
}
