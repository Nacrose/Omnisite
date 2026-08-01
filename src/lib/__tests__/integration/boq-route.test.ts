import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration tests for /api/boq — exercises the full request pipeline:
 *   requireAuth → checkRateLimit → validateBody → createUserClient →
 *   upsertWithAudit → logDbError → response
 *
 * The Supabase clients are mocked so we can assert what the route writes,
 * without needing a real database. The mocks also let us simulate
 * unauthorized / forbidden / validation-error paths.
 */

// ─── Mocks ─────────────────────────────────────────────────────────────────

// The BOQ route calls these from supabase-server. We mock the module so
// the route never tries to talk to a real Supabase instance.
const mockUserClient = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase-server', () => ({
  createUserClient: vi.fn(() => mockUserClient),
  isServerSupabaseConfigured: vi.fn(() => true),
  getServiceClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: { id: '1.1.1', code: '1.1.1' }, error: null }),
  })),
  isServiceClientConfigured: vi.fn(() => true),
}))

// requireAuth reads the user from the Supabase session. Mock it to return
// a known user by default — individual tests override this.
const mockUser = {
  id: 'user-uuid-1',
  email: 'pm@omnisite.test',
  role: 'PM' as const,
  accessToken: 'fake-jwt-token',
}

vi.mock('@/lib/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-auth')>('@/lib/api-auth')
  return {
    ...actual,
    requireAuth: vi.fn(async () => ({ user: mockUser, error: null })),
    requireRole: vi.fn(() => null),
    verifyProjectAccess: vi.fn(async () => true),
    isProjectScopedTable: vi.fn(() => true),
    getPrimaryKey: vi.fn(() => 'id'),
  }
})

// Rate limiter — always allow.
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}))

// Audit helper — mock the RPC to succeed by default.
// Typed loosely to avoid friction with the real signature; the test
// assertions check call args + return values, not types.
const mockUpsertWithAudit = vi.fn(
  async (
    _table: string,
    _row: Record<string, unknown>,
    _pk: string,
    _userId: string,
    _action: string,
    _old: Record<string, unknown> | null
  ): Promise<{ data: Record<string, unknown> | null; error: string | null }> => ({
    data: { id: '1.1.1', code: '1.1.1', description: 'Test' },
    error: null,
  })
)
const mockDeleteWithAudit = vi.fn(
  async (
    _table: string,
    _recordId: string,
    _pk: string,
    _userId: string
  ): Promise<{ deleted: boolean; error: string | null }> => ({ deleted: true, error: null })
)

vi.mock('@/lib/audit', () => ({
  upsertWithAudit: mockUpsertWithAudit,
  deleteWithAudit: mockDeleteWithAudit,
  logAudit: vi.fn(async () => undefined),
  computeDiff: vi.fn(() => ({})),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeGetReq(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'GET' })
}

function makePostReq(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteReq(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'DELETE' })
}

async function json(res: Response): Promise<unknown> {
  return JSON.parse(await res.text())
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('/api/boq integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Re-establish default implementations after clearAllMocks wipes them.
    const { requireAuth, verifyProjectAccess, requireRole, isProjectScopedTable, getPrimaryKey } =
      await import('@/lib/api-auth')
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, error: null })
    vi.mocked(requireRole).mockReturnValue(null)
    vi.mocked(verifyProjectAccess).mockResolvedValue(true)
    vi.mocked(isProjectScopedTable).mockReturnValue(true)
    vi.mocked(getPrimaryKey).mockReturnValue('id')

    // Default: userClient.from returns a chainable query for the pre-flight
    // SELECT (oldData) check in POST, and the SELECT in DELETE.
    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }), // no existing row → INSERT path
          limit: async () => ({ data: [{ id: '1.1.1' }], error: null }),
        }),
        gt: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
    }))
  })

  // ─── GET ──────────────────────────────────────────────────────────────

  it('GET returns 401 when auth fails', async () => {
    const { requireAuth } = await import('@/lib/api-auth')
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuth).mockResolvedValueOnce({
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const { GET } = await import('@/app/api/boq/route')
    const res = await GET(makeGetReq('/api/boq'))

    expect(res.status).toBe(401)
  })

  it('GET fetches items with cursor pagination envelope', async () => {
    // Mock userClient.from for the GET query path. The route chains:
    //   .from('boq_items').select('*').eq('project_id', ...).gt('code', cursor).limit(N+1).order('code', ...)
    // We make every chainable method return the same builder that resolves to our test data.
    const testRows = [
      { id: '1.1', code: '1.1', description: 'a' },
      { id: '1.2', code: '1.2', description: 'b' },
      { id: '1.3', code: '1.3', description: 'c' },
    ]
    const builder = {
      select: () => builder,
      eq: () => builder,
      gt: () => builder,
      limit: () => builder,
      order: async () => ({ data: testRows, error: null }),
    }
    mockUserClient.from.mockImplementationOnce(() => builder)

    const { GET } = await import('@/app/api/boq/route')
    const res = await GET(makeGetReq('/api/boq?limit=2&cursor=1.0'))

    expect(res.status).toBe(200)
    const body = (await json(res)) as { data: unknown[]; nextCursor: unknown }
    expect(body.data).toHaveLength(2)
    expect(body.nextCursor).toBe('1.2')
  })

  // ─── POST ─────────────────────────────────────────────────────────────

  it('POST rejects an invalid body with 400', async () => {
    const { POST } = await import('@/app/api/boq/route')
    const res = await POST(makePostReq('/api/boq', { id: '' })) // missing required fields
    expect(res.status).toBe(400)
  })

  it('POST upserts via upsertWithAudit and returns 200', async () => {
    const { POST } = await import('@/app/api/boq/route')
    const validBody = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Test item',
      type: 'Priced' as const,
      qty: 100,
      uom: 'cum',
      rate: 500,
    }

    const res = await POST(makePostReq('/api/boq', validBody))

    expect(res.status).toBe(200)
    expect(mockUpsertWithAudit).toHaveBeenCalledTimes(1)
    expect(mockUpsertWithAudit.mock.calls[0][0]).toBe('boq_items')
    const passedRow = mockUpsertWithAudit.mock.calls[0][1] as Record<string, unknown>
    expect(passedRow.code).toBe('1.1.1')
  })

  it('POST returns 403 when verifyProjectAccess denies an INSERT', async () => {
    const { verifyProjectAccess } = await import('@/lib/api-auth')
    // Override the default mock for this test only — beforeEach will reset.
    vi.mocked(verifyProjectAccess).mockResolvedValueOnce(false)

    const { POST } = await import('@/app/api/boq/route')
    const res = await POST(
      makePostReq('/api/boq', {
        id: '9.9.9',
        code: '9.9.9',
        description: 'Forbidden item', // required field — passes validation
        project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      })
    )

    expect(res.status).toBe(403)
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })

  it('POST returns 500 when upsertWithAudit errors', async () => {
    mockUpsertWithAudit.mockResolvedValueOnce({ data: null, error: 'boom' })

    const { POST } = await import('@/app/api/boq/route')
    const res = await POST(
      makePostReq('/api/boq', {
        id: '1.1.1',
        code: '1.1.1',
        description: 'Test', // required — passes validation
      })
    )

    expect(res.status).toBe(500)
  })

  // ─── DELETE ───────────────────────────────────────────────────────────

  it('DELETE returns 400 when id is missing', async () => {
    const { DELETE } = await import('@/app/api/boq/route')
    const res = await DELETE(makeDeleteReq('/api/boq'))
    expect(res.status).toBe(400)
  })

  it('DELETE returns 404 when the row does not exist (RLS denies or not found)', async () => {
    mockUserClient.from.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }))

    const { DELETE } = await import('@/app/api/boq/route')
    const res = await DELETE(makeDeleteReq('/api/boq?id=nonexistent'))

    expect(res.status).toBe(404)
    expect(mockDeleteWithAudit).not.toHaveBeenCalled()
  })

  it('DELETE calls deleteWithAudit when row exists', async () => {
    const { DELETE } = await import('@/app/api/boq/route')
    const res = await DELETE(makeDeleteReq('/api/boq?id=1.1.1'))

    expect(res.status).toBe(200)
    expect(mockDeleteWithAudit).toHaveBeenCalledTimes(1)
    expect(mockDeleteWithAudit.mock.calls[0][0]).toBe('boq_items')
    expect(mockDeleteWithAudit.mock.calls[0][1]).toBe('1.1.1')
  })
})
