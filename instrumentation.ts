export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ─── Env-var validation on Vercel ─────────────────────────────────────
    // Only enforce on Vercel deployments (VERCEL=1). CI runs (GitHub Actions,
    // local e2e tests) deliberately run in demo mode without real credentials
    // and should not be blocked by this check.
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL === '1') {
      const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
      ]
      const missing = required.filter((k) => !process.env[k])
      if (missing.length > 0) {
        throw new Error(
          `FATAL: Missing required environment variables in production: ${missing.join(', ')}.\n` +
            'Set these in your Vercel project settings before deploying.'
        )
      }
    }

    // ─── Initialize Sentry ────────────────────────────────────────────────
    await import('./src/lib/sentry')
  }
}
