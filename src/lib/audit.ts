import { supabase, isServerSupabaseConfigured } from '@/lib/supabase-server'

export interface AuditEntry {
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_fields?: Record<string, { old: unknown; new: unknown }>
  timestamp: string
}

/**
 * Server-side audit trail logger.
 * Records who changed what, when — critical for FIDIC contract compliance.
 *
 * In production, this would be called from API route handlers
 * before/after each mutation.
 */
export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  if (!isServerSupabaseConfigured()) {
    // If no DB, log to console (development mode)
    console.log('[AUDIT]', { ...entry, timestamp: new Date().toISOString() })
    return
  }

  try {
    await supabase.from('audit_log').insert({
      ...entry,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    // Don't fail the mutation if audit logging fails
    console.error('[AUDIT] Failed to log:', e)
  }
}

/**
 * Client-side audit helper — logs to localStorage when offline.
 * These get synced to the server when connectivity resumes.
 */
const AUDIT_QUEUE_KEY = 'omnisite-audit-queue'

export function logAuditClient(
  tableName: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  changedBy: string = 'Arjun Sharma',
  changedFields?: Record<string, { old: unknown; new: unknown }>
): void {
  const entry: AuditEntry = {
    table_name: tableName,
    record_id: recordId,
    action,
    changed_by: changedBy,
    changed_fields: changedFields,
    timestamp: new Date().toISOString(),
  }

  if (typeof window === 'undefined') return

  try {
    const queue = JSON.parse(localStorage.getItem(AUDIT_QUEUE_KEY) || '[]')
    queue.push(entry)
    // Keep last 500 entries
    if (queue.length > 500) queue.shift()
    localStorage.setItem(AUDIT_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get recent audit entries from the localStorage queue.
 */
export function getAuditLog(): AuditEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(AUDIT_QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * Clear the audit queue (after successful sync to server).
 */
export function clearAuditQueue(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUDIT_QUEUE_KEY)
}
