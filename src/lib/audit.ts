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
 *
 * Only fields whose JSON-serialized value differs between `old` and `new_`
 * are included in the returned map — unchanged fields are omitted so the
 * audit log stays compact and the diff is immediately actionable for
 * reviewers (e.g. FIDIC dispute resolution).
 *
 * Note: only keys present on `new_` are inspected. Fields that existed on
 * `old` but were removed from `new_` will not appear in the diff; this is
 * fine for the upsert use case (POST bodies always carry the full row).
 *
 * @example
 *   computeDiff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })
 *   // → { b: { old: 2, new: 3 }, c: { old: undefined, new: 4 } }
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
 * Records who changed what, when — critical for FIDIC contract compliance.
 *
 * Uses the service-role client (bypasses RLS) so audit entries are always
 * written regardless of the user's permissions. This is the ONLY legitimate
 * use of the service-role key in the app — all user-facing data queries
 * use the user-scoped client (createUserClient) which is RLS-enforced.
 *
 * Called from API route handlers after each mutation (POST/DELETE).
 */
export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  if (!isServiceClientConfigured()) {
    // If no service key, log to console (development mode)
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
    // Don't fail the mutation if audit logging fails
    console.error('[AUDIT] Failed to log:', e)
  }
}
