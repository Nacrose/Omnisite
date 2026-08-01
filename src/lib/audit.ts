import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'

export interface AuditEntry {
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_fields?: { old: unknown; new: unknown }
  timestamp: string
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
