import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration tests for /api/tasks — same pipeline as /api/boq but for the
 * tasks table. Verifies the refactored POST/DELETE handlers work for a
 * non-BOQ table, and that the route correctly exercises upsertWithAudit
 * with the right table name + PK.
 */

const mockUserClient = { from: vi.fn() }

vi.mock('@/lib/supabase-server', () => ({
  createUserClient: vi.fn(() => mockUserClient),
  isServerSupabaseConfigured: vi.fn(() => true),
  getServiceClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: { id: 'T-100', name: 'Test task' }, error: null }),
  })),
  isServiceClientConfigured: vi.fn(() => true),
}))

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
    data: { id: 'T-100', name: 'Test task' },
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

describe('/api/tasks integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { requireAuth, verifyProjectAccess, requireRole, isProjectScopedTable, getPrimaryKey } =
      await import('@/lib/api-auth')
    vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, error: null })
    vi.mocked(requireRole).mockReturnValue(null)
    vi.mocked(verifyProjectAccess).mockResolvedValue(true)
    vi.mocked(isProjectScopedTable).mockReturnValue(true)
    vi.mocked(getPrimaryKey).mockReturnValue('id')

    mockUserClient.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          limit: async () => ({ data: [{ id: 'T-100' }], error: null }),
        }),
      }),
    }))
  })

  it('POST upserts a task via upsertWithAudit with table=tasks', async () => {
    const { POST } = await import('@/app/api/tasks/route')
    const res = await POST(
      makePostReq('/api/tasks', {
        id: 'T-100',
        name: 'PCC M15 casting',
        type: 'Work',
        start_week: 1,
        duration: 2,
      })
    )

    expect(res.status).toBe(200)
    expect(mockUpsertWithAudit).toHaveBeenCalledTimes(1)
    expect(mockUpsertWithAudit.mock.calls[0][0]).toBe('tasks')
    expect(mockUpsertWithAudit.mock.calls[0][2]).toBe('id') // PK
  })

  it('POST rejects an invalid task body with 400', async () => {
    const { POST } = await import('@/app/api/tasks/route')
    const res = await POST(makePostReq('/api/tasks', { id: '' })) // missing name
    expect(res.status).toBe(400)
    expect(mockUpsertWithAudit).not.toHaveBeenCalled()
  })

  it('DELETE returns 400 when id is missing', async () => {
    const { DELETE } = await import('@/app/api/tasks/route')
    const res = await DELETE(makeDeleteReq('/api/tasks'))
    expect(res.status).toBe(400)
  })

  it('DELETE returns 404 when row does not exist', async () => {
    mockUserClient.from.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }))
    const { DELETE } = await import('@/app/api/tasks/route')
    const res = await DELETE(makeDeleteReq('/api/tasks?id=nonexistent'))
    expect(res.status).toBe(404)
    expect(mockDeleteWithAudit).not.toHaveBeenCalled()
  })

  it('DELETE calls deleteWithAudit with table=tasks', async () => {
    const { DELETE } = await import('@/app/api/tasks/route')
    const res = await DELETE(makeDeleteReq('/api/tasks?id=T-100'))
    expect(res.status).toBe(200)
    expect(mockDeleteWithAudit).toHaveBeenCalledTimes(1)
    expect(mockDeleteWithAudit.mock.calls[0][0]).toBe('tasks')
    expect(mockDeleteWithAudit.mock.calls[0][1]).toBe('T-100')
  })
})
