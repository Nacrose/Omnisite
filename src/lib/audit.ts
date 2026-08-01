import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'

export interface AuditEntry {
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_fields?: Record<string, { old: unknown; new: unknown }>
  timestamp: string
}

/**
 * Compute a field-level diff between two record snapshots.
 */
export function computeDiff(
  old: Record<string, unknown>,
  new_: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const key of Object.keys(new_)) {
    if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
      diff[key] = { old: old[key], new: new_[key] }
    }
  }
  return diff
}

/**
 * Server-side audit trail logger.
 *
 * On failure, reports to Sentry (if configured) and logs to console.
 * Never rejects — audit failures must not fail the mutation.
 */
export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  if (!isServiceClientConfigured()) {
    console.log('[AUDIT]', { ...entry, timestamp: new Date().toISOString() })
    return
  }

  try {
    const serviceClient = getServiceClient()
    await serviceClient.from('audit_log').insert({
      ...entry,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[AUDIT] Failed to log:', e)
    // Report to Sentry if configured
    try {
      const { Sentry } = await import('@/lib/sentry')
      Sentry.captureException(e)
    } catch {
      // Sentry not configured — console.error above is sufficient
    }
  }
}
