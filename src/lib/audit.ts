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
  new_: Record<string, unknown>
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
 *
 * NOTE: This is the legacy fire-and-forget pattern. Prefer upsertWithAudit()
 * for new routes — it performs the business write + audit entry in a single
 * Postgres transaction, so the audit trail is never lost.
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

/**
 * Transactional upsert + audit log in a single Postgres transaction.
 *
 * Calls the `upsert_with_audit()` Postgres function (defined in migration
 * 00000000000007) which:
 *   1. Upserts the row into p_table (ON CONFLICT p_pk DO UPDATE)
 *   2. Inserts an audit_log entry with field-level diff
 *   3. Returns the resulting row as JSON
 *
 * If either step fails, BOTH roll back — the business write is never
 * committed without an audit trail.
 *
 * @param p_table - Table name (e.g. 'boq_items')
 * @param p_row - Row data as JSON (must include the PK field)
 * @param p_pk - Primary key column name (e.g. 'id' or 'code')
 * @param p_user_id - The authenticated user's id (from requireAuth)
 * @param p_action - 'INSERT' | 'UPDATE' | 'DELETE'
 * @param p_old_values - Previous row snapshot (for UPDATE/DELETE diff). Null for INSERT.
 * @returns The upserted row as JSON, or null on failure.
 */
export async function upsertWithAudit(
  p_table: string,
  p_row: Record<string, unknown>,
  p_pk: string,
  p_user_id: string,
  p_action: 'INSERT' | 'UPDATE' | 'DELETE',
  p_old_values: Record<string, unknown> | null
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  if (!isServiceClientConfigured()) {
    // Demo mode — service role key not configured. Warn loudly so the
    // operator knows upsertWithAudit is a no-op and that writes will NOT
    // land in Supabase. Previously this branch returned silently with
    // `{ data: p_row, error: null }`, which looked indistinguishable from
    // a real upsert success — making this misconfiguration very hard to
    // notice.
    console.warn(
      '[AUDIT] Service role key not configured — upsertWithAudit is a no-op. Data will NOT be persisted to Supabase. Set SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
    return { data: p_row, error: null }
  }

  try {
    const serviceClient = getServiceClient()
    const { data, error } = await serviceClient.rpc('upsert_with_audit', {
      p_table,
      p_row: p_row as Record<string, unknown> as object,
      p_pk,
      p_user_id,
      p_action,
      p_old_values: p_old_values as Record<string, unknown> as object,
    })

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as Record<string, unknown>, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { data: null, error: msg }
  }
}

/**
 * Transactional delete + audit log in a single Postgres transaction.
 *
 * Calls the `delete_with_audit()` Postgres function (defined in migration
 * 00000000000007) which:
 *   1. Captures the pre-delete row state
 *   2. Deletes the row
 *   3. Inserts an audit_log entry with the captured state as old_values
 *
 * If either step fails, BOTH roll back — the audit trail is never lost.
 *
 * @param p_table - Table name (must be in the function's allowlist)
 * @param p_record_id - The primary key value of the row to delete
 * @param p_pk - Primary key column name (e.g. 'id' or 'code')
 * @param p_user_id - The authenticated user's id (from requireAuth)
 * @returns { deleted: boolean, error: string | null } — deleted=false means
 *          the row didn't exist (no audit entry written).
 */
export async function deleteWithAudit(
  p_table: string,
  p_record_id: string,
  p_pk: string,
  p_user_id: string
): Promise<{ deleted: boolean; error: string | null }> {
  if (!isServiceClientConfigured()) {
    // Demo mode — no audit log, just report success.
    return { deleted: true, error: null }
  }

  try {
    const serviceClient = getServiceClient()
    const { data, error } = await serviceClient.rpc('delete_with_audit', {
      p_table,
      p_record_id,
      p_pk,
      p_user_id,
    })

    if (error) {
      return { deleted: false, error: error.message }
    }

    return { deleted: !!data, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { deleted: false, error: msg }
  }
}
