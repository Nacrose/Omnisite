export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ─── Startup guard: forbid demo mode in production ────────────────────
    if (process.env.NODE_ENV === 'production' && process.env.OMNISITE_DEMO_MODE === 'true') {
      throw new Error(
        'FATAL: OMNISITE_DEMO_MODE=true is forbidden in production. ' +
          'This would bypass authentication and expose all data. ' +
          'Remove this env var or set it to false before deploying.'
      )
    }

    // ─── Env-var validation in production ─────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
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
