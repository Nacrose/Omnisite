/**
 * Next.js instrumentation hook — runs once per server instance at startup.
 *
 * Used to initialize Sentry on the Node.js runtime. The Edge runtime is
 * intentionally skipped here; @sentry/nextjs handles its own edge-side init.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./src/lib/sentry')
  }
}
