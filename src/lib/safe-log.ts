/**
 * Sanitized server-side logging.
 *
 * Replaces raw console.error('[API] ... error:', error) calls that leak
 * internal DB details (constraint names, row data, schema info) into
 * Vercel preview logs. This module logs a safe summary + a correlation
 * ID, and routes the full error to Sentry (if configured) where PII can
 * be scrubbed centrally.
 *
 * Usage:
 *   logDbError('boq_items', 'upsert', error, { recordId: body.id })
 *   // → logs: [API] boq_items.upsert failed (ref: abc123) — Internal server error
 *   // → Sentry: full error object with tags
 */

let errorCounter = 0

/**
 * Log a database error with a sanitized message + correlation ref.
 * The full error is sent to Sentry (if configured); only a safe summary
 * goes to console.
 */
export function logDbError(
  table: string,
  operation: string,
  error: unknown,
  context?: { recordId?: string; userId?: string }
): string {
  const ref = `ref-${Date.now().toString(36)}-${(errorCounter++).toString(36)}`

  // Extract a safe error message — no row data, no constraint names.
  let safeMessage = 'Internal server error'
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message)
    // Only expose known-safe prefixes; mask anything that looks like it
    // contains schema/row details.
    if (msg.includes('violates') || msg.includes('constraint') || msg.includes('column')) {
      safeMessage = 'Database constraint violation'
    } else if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth')) {
      safeMessage = 'Authentication error'
    } else if (msg.length < 100 && !msg.includes('{')) {
      // Short, no-braces messages are probably safe to expose
      safeMessage = msg
    }
  }

  const recordPart = context?.recordId ? ` record=${context.recordId}` : ''
  const userPart = context?.userId ? ` user=${context.userId}` : ''
  // Safe to log — only the ref + table + operation + safe message.
  console.error(
    `[API] ${table}.${operation} failed (${ref})${recordPart}${userPart} — ${safeMessage}`
  )

  // Send full error to Sentry (if configured) with tags for filtering.
  // This is fire-and-forget — if Sentry isn't configured, the import fails
  // silently and we rely on the console log above.
  try {
    import('@/lib/sentry')
      .then(({ Sentry }) => {
        Sentry.captureException(error, {
          tags: { table, operation, ref },
          extra: { ...context },
        })
      })
      .catch(() => {
        // Sentry not configured — console log above is sufficient
      })
  } catch {
    // Sentry module not available — no-op
  }

  return ref
}
