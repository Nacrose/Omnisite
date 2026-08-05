import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock the server-side supabase module BEFORE importing api-auth — the latter
// reads from the former at module-load time (for the `supabase` singleton used
// by `resolveUserRole`). We don't exercise `resolveUserRole` here, but the mock
// must exist so the import doesn't try to hit real env vars.
vi.mock('@/lib/supabase-server', () => ({
  supabase: {},
  isServerSupabaseConfigured: () => true,
  createUserClient: () => ({}),
}))

import { verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'

// ─── Test helpers ──────────────────────────────────────────────────────────

/**
 * Build a fake SupabaseClient whose `from(table).select(...).eq(...).eq(...)
 * .limit(...)` chain returns a configurable result. We only mock the chain
 * that `verifyProjectAccess` actually walks.
 */
function makeFakeUserClient(result: { data: unknown[] | null; error: unknown | null }) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue(chain),
  })
  return { from } as unknown as SupabaseClient
}

// ─── verifyProjectAccess ───────────────────────────────────────────────────
//
// `verifyProjectAccess` is the explicit ownership check that closes the
// cross-project-write attack vector when routes use `upsertWithAudit()`
// (service-role, RLS-bypassed). These tests exercise every branch:
//   1. undefined / null / empty project_id → false (no DB call)
//   2. user_projects row exists → true
//   3. user_projects row missing → false
//   4. DB error → false (fail-closed)
//   5. data is null → false (defensive — shouldn't happen but PostgREST can)

describe('verifyProjectAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when project_id is undefined', async () => {
    const client = makeFakeUserClient({ data: [], error: null })
    const result = await verifyProjectAccess(client, 'user-1', undefined)
    expect(result).toBe(false)
  })

  it('returns false when project_id is null', async () => {
    const client = makeFakeUserClient({ data: [], error: null })
    const result = await verifyProjectAccess(client, 'user-1', null)
    expect(result).toBe(false)
  })

  it('returns false when project_id is empty string', async () => {
    const client = makeFakeUserClient({ data: [], error: null })
    const result = await verifyProjectAccess(client, 'user-1', '')
    expect(result).toBe(false)
  })

  it('returns true when the user has a user_projects row for the project', async () => {
    const client = makeFakeUserClient({
      data: [{ project_id: 'proj-1' }],
      error: null,
    })
    const result = await verifyProjectAccess(client, 'user-1', 'proj-1')
    expect(result).toBe(true)
  })

  it('returns false when the user has no user_projects row for the project', async () => {
    const client = makeFakeUserClient({ data: [], error: null })
    const result = await verifyProjectAccess(client, 'user-1', 'proj-other')
    expect(result).toBe(false)
  })

  it('returns false (fail-closed) when the DB returns an error', async () => {
    const client = makeFakeUserClient({
      data: null,
      error: { message: 'permission denied' },
    })
    const result = await verifyProjectAccess(client, 'user-1', 'proj-1')
    expect(result).toBe(false)
  })

  it('returns false when data is null (defensive — should not happen but PostgREST can return null on error)', async () => {
    const client = makeFakeUserClient({ data: null, error: null })
    const result = await verifyProjectAccess(client, 'user-1', 'proj-1')
    expect(result).toBe(false)
  })

  it('queries user_projects with the correct user_id AND project_id', async () => {
    const chain = {
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ project_id: 'proj-1' }], error: null }),
    }
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(chain),
    })
    const client = { from } as unknown as SupabaseClient

    await verifyProjectAccess(client, 'user-42', 'proj-99')

    // Verify the table name
    expect(from).toHaveBeenCalledWith('user_projects')
    // Verify both eq() calls — order matters: user_id first, then project_id
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-42')
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'project_id', 'proj-99')
    // Verify limit(1) was called (don't fetch more than we need)
    expect(chain.limit).toHaveBeenCalledWith(1)
  })
})

// ─── isProjectScopedTable ──────────────────────────────────────────────────
//
// `isProjectScopedTable` decides whether `createCrudHandler` calls
// `verifyProjectAccess` on writes. A false-positive (returns true for a table
// without project_id) would cause a runtime error; a false-negative (returns
// false for a project-scoped table) would silently disable the ownership
// check — a security regression.

describe('isProjectScopedTable', () => {
  it('returns true for known project-scoped tables', () => {
    const knownTables = [
      'boq_items',
      'tasks',
      'dsr_entries',
      'cbs_nodes',
      'requisitions',
      'purchase_orders',
      'drawings',
      'letters',
      'qs_items',
      'equipment',
      'subcontractors',
      'workers',
      'chat_messages',
      'grns',
      'stock_items',
      'vendors',
      'project_locations',
      'drawing_annotations',
    ]
    for (const table of knownTables) {
      expect(isProjectScopedTable(table)).toBe(true)
    }
  })

  it('returns false for non-project-scoped tables', () => {
    expect(isProjectScopedTable('projects')).toBe(false)
    expect(isProjectScopedTable('user_projects')).toBe(false)
    expect(isProjectScopedTable('audit_log')).toBe(false)
    expect(isProjectScopedTable('task_dependencies')).toBe(false)
  })

  it('returns false for unknown / mistyped table names', () => {
    expect(isProjectScopedTable('boqitem')).toBe(false)
    expect(isProjectScopedTable('BOQ_ITEMS')).toBe(false) // case-sensitive
    expect(isProjectScopedTable('')).toBe(false)
  })
})
