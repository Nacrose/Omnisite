import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Cross-project-write attack test ───────────────────────────────────────
//
// Attack vector: a malicious user with a valid session on Project A crafts
// a POST body with `project_id: <project-B-uuid>`. Without `verifyProjectAccess`,
// the service-role `upsertWithAudit()` would write the row to Project B —
// which the user has no access to — because the service role bypasses RLS.
//
// `verifyProjectAccess` closes this by explicitly checking user_projects
// before every write to a project-scoped table. These tests verify the guard
// fires on the forged-project_id path AND that it's called with the correct
// arguments (the user's id + the body's project_id, NOT the user's session
// project).

const mockUserClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase-server', () => ({
  createUserClient: vi.fn(() => mockUserClient),
  isServerSupabaseConfigured: vi.fn(() => true),
  getServiceClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
  })),
  isServiceClientConfigured: vi.fn(() => true),
}))

const mockUser = {
  id: 'user-uuid-attacker',
  email: 'attacker@omnisite.test',
  role: 'PM' as const,
  accessToken: 'fake-jwt-token',
}

vi.mock('@/lib/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-auth')>('@/lib/api-auth')
  return {
    ...actual,
    requireAuth: vi.fn(async () => ({ user: mockUser, error: null })),
    requireRole: vi.fn(() => null),
    // Real implementation — we want to exercise verifyProjectAccess itself,
    // not a mock. The user_projects query is mocked via mockUserClient.
    verifyProjectAccess: actual.verifyProjectAccess,
    isProjectScopedTable: vi.fn(() => true),
    getPrimaryKey: vi.fn(() => 'id'),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}))

const mockUpsertWithAudit = vi.fn(
  async (
    _table: string,
    _row: Record<string, unknown>,
    _pk: string,
    _userId: string,
    _action: string,
    _old: Record<string, unknown> | null
  ): Promise<{ data: Record<string, unknown> | null; error: string | null }> => ({
    data: { id: '1' },
    error: null,
  })
)

vi.mock('@/lib/audit', () => ({
  upsertWithAudit: mockUpsertWithAudit,
  deleteWithAudit: vi.fn(async () => ({ deleted: true, error: null })),
  logAudit: vi.fn(async () => undefined),
  computeDiff: vi.fn(() => ({})),
}))

function makePostReq(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { requireAuth, requireRole, isProjectScopedTable, getPrimaryKey } =
    await import('@/lib/api-auth')
  vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, error: null })
  vi.mocked(requireRole).mockReturnValue(null)
  vi.mocked(isProjectScopedTable).mockReturnValue(true)
  vi.mocked(getPrimaryKey).mockReturnValue('id')

  // Default: user_projects query returns empty (no access).
  mockUserClient.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: async () => ({ data: [], error: null }), // no user_projects row
        }),
        single: async () => ({ data: null, error: null }),
      }),
      gt: () => ({
        order: async () => ({ data: [], error: null }),
      }),
      order: async () => ({ data: [], error: null }),
    }),
  }))
})

describe('cross-project-write attack (forged project_id in body)', () => {
  it('blocks a POST with a project_id the user has no access to', async () => {
    // Attacker is on Project A but tries to write to Project B.
    // Both UUIDs are valid v4 (Zod's .uuid() rejects nil/invalid-variant UUIDs).
    const OWN_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' // Project A
    const FORGED_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' // Project B (no access)

    // user_projects query for (attacker, Project B) returns empty
    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: (col: string, val: string) => ({
            limit: async () => {
              // Return empty for the forged project (no access)
              if (col === 'project_id' && val === FORGED_PROJECT) {
                return { data: [], error: null }
              }
              // Return a row for the user's own project
              if (col === 'project_id' && val === OWN_PROJECT) {
                return { data: [{ project_id: OWN_PROJECT }], error: null }
              }
              return { data: [], error: null }
            },
          }),
          single: async () => ({ data: null, error: null }),
        }),
        gt: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }))

    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'malicious row',
      type: 'Priced',
      qty: 1,
      uom: 'cum',
      rate: 100,
      project_id: FORGED_PROJECT, // forged
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    expect(res.status).toBe(403)
    const bodyJson = (await res.json()) as { error: string }
    expect(bodyJson.error).toMatch(/project|access|forbidden/i)

    // Verify upsertWithAudit was NOT called — the guard fired before it.
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })

  it('allows a POST with the user own project_id', async () => {
    const OWN_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'

    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: (col: string, val: string) => ({
            limit: async () => {
              if (col === 'project_id' && val === OWN_PROJECT) {
                return { data: [{ project_id: OWN_PROJECT }], error: null }
              }
              return { data: [], error: null }
            },
          }),
          single: async () => ({ data: null, error: null }),
        }),
        gt: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }))

    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'legitimate row',
      type: 'Priced',
      qty: 1,
      uom: 'cum',
      rate: 100,
      project_id: OWN_PROJECT, // user has access
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    expect(res.status).toBe(200)
    expect(mockUpsertWithAudit).toHaveBeenCalledOnce()
  })

  it('blocks a POST when project_id is missing (fail-closed)', async () => {
    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'no project_id',
      type: 'Priced',
      qty: 1,
      uom: 'cum',
      rate: 100,
      // project_id intentionally missing — verifyProjectAccess returns false
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    // verifyProjectAccess returns false for undefined/null project_id
    expect(res.status).toBe(403)
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })

  it('blocks a POST when the user_projects query errors (fail-closed)', async () => {
    const FORGED_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'

    // Simulate a DB error on the user_projects query
    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({ data: null, error: { message: 'permission denied' } }),
          }),
          single: async () => ({ data: null, error: null }),
        }),
        gt: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }))

    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'db error on access check',
      type: 'Priced',
      qty: 1,
      uom: 'cum',
      rate: 100,
      project_id: FORGED_PROJECT,
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    // Fail-closed: DB error → no access → 403
    expect(res.status).toBe(403)
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })
})

// ─── Cross-project UPDATE attack (project_id mutation) ─────────────────────
//
// Attack vector: a malicious user with read access to a row in Project A
// re-POSTs the row back with project_id: <Project B>. Without the UPDATE
// gate, the service-role upsertWithAudit (which bypasses RLS) would silently
// move the row into Project B — a project the user has no assignment to.
//
// The fix rejects any project_id change on UPDATE; project transfer must
// use a dedicated admin-only endpoint (not implemented yet).

describe('cross-project UPDATE attack (project_id mutation on update)', () => {
  const OWN_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' // Project A
  const FORGED_PROJECT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' // Project B
  const ROW_ID = '1.1.1'

  beforeEach(async () => {
    // The pre-flight read returns the existing row (with project_id = OWN_PROJECT).
    // This proves the user has RLS read access to the row in Project A.
    // The subsequent user_projects query (for the INSERT path) is never
    // reached on UPDATE — but we mock it anyway to make sure the test isn't
    // accidentally passing because of the INSERT-path guard firing.
    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          // .single() path — used by the pre-flight read in POST
          single: async () => ({
            data: {
              id: ROW_ID,
              code: ROW_ID,
              description: 'existing row in Project A',
              type: 'Priced',
              qty: 1,
              uom: 'cum',
              rate: 100,
              project_id: OWN_PROJECT,
            },
            error: null,
          }),
          eq: (col: string, val: string) => ({
            limit: async () => {
              if (col === 'project_id' && val === OWN_PROJECT) {
                return { data: [{ project_id: OWN_PROJECT }], error: null }
              }
              return { data: [], error: null }
            },
          }),
        }),
        // .gt().order() path — used by GET, not relevant here
        gt: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }))
  })

  it('blocks an UPDATE that changes project_id to a foreign project', async () => {
    const { POST } = await import('@/app/api/boq/route')
    // Body includes the existing PK so the route treats this as an UPDATE.
    // The attacker sets project_id = FORGED_PROJECT to move the row out of
    // their assigned project into one they have no access to.
    const body = {
      id: ROW_ID,
      code: ROW_ID,
      description: 'existing row, attempting project transfer',
      type: 'Priced',
      qty: 1,
      uom: 'cum',
      rate: 100,
      project_id: FORGED_PROJECT, // ← attack: try to move the row
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    expect(res.status).toBe(403)
    const bodyJson = (await res.json()) as { error: string }
    expect(bodyJson.error).toMatch(/project_id|transfer/i)
    // Verify upsertWithAudit was NOT called — the guard fired before it.
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })

  it('allows an UPDATE that keeps the same project_id', async () => {
    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: ROW_ID,
      code: ROW_ID,
      description: 'updated description',
      type: 'Priced',
      qty: 2,
      uom: 'cum',
      rate: 110,
      project_id: OWN_PROJECT, // same project — legitimate update
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    expect(res.status).toBe(200)
    expect(mockUpsertWithAudit).toHaveBeenCalledOnce()
  })

  it('restores the original project_id when body omits it on UPDATE', async () => {
    const { POST } = await import('@/app/api/boq/route')
    const body = {
      id: ROW_ID,
      code: ROW_ID,
      description: 'updated description, no project_id in body',
      type: 'Priced',
      qty: 2,
      uom: 'cum',
      rate: 110,
      // project_id intentionally omitted — should be restored from oldData
    }
    const res = await POST(makePostReq('http://localhost:3000/api/boq', body))

    expect(res.status).toBe(200)
    // Verify upsertWithAudit was called with the restored project_id
    expect(mockUpsertWithAudit).toHaveBeenCalledOnce()
    const callArgs = mockUpsertWithAudit.mock.calls[0]
    const rowArg = callArgs[1] as Record<string, unknown>
    expect(rowArg.project_id).toBe(OWN_PROJECT)
  })
})
