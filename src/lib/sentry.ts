import * as Sentry from '@sentry/nextjs'

/**
 * Sentry initialization.
 * Set NEXT_PUBLIC_SENTRY_DSN in your Vercel env vars to enable.
 * If not set, Sentry is a no-op (all methods are safe to call).
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN && !Sentry.isInitialized()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% of transactions traced
    environment: process.env.NODE_ENV,
    // Filter out noisy errors
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'Network request failed'],
  })
}

export { Sentry }
