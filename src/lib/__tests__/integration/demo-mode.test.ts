import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Demo-mode short-circuit tests ─────────────────────────────────────────
//
// Verifies that createCrudHandler returns 200+[] for GET and 503 for
// POST/DELETE when Supabase is not configured (demo mode). Without this
// guard, createUserClient('') throws "Supabase not configured" (500) on
// every request — the bug fixed in commit 7978967 + pass-2 commit 04e52f5.

vi.mock('@/lib/supabase-server', () => ({
  createUserClient: vi.fn(() => {
    throw new Error('Supabase not configured')
  }),
  getServiceClient: vi.fn(() => {
    throw new Error('Supabase not configured')
  }),
  isServerSupabaseConfigured: vi.fn(() => false),
  isServiceClientConfigured: vi.fn(() => false),
}))

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn(async () => ({
    user: { id: 'demo-user', email: 'demo@omnisite', role: 'PM', accessToken: '' },
    error: null,
  })),
  requireRole: vi.fn(() => null),
  verifyProjectAccess: vi.fn(async () => true),
  isProjectScopedTable: vi.fn(() => true),
  getPrimaryKey: vi.fn(() => 'id'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/audit', () => ({
  upsertWithAudit: vi.fn(),
  deleteWithAudit: vi.fn(),
  logAudit: vi.fn(),
  computeDiff: vi.fn(() => ({})),
}))

vi.mock('@/lib/safe-log', () => ({
  logDbError: vi.fn(),
}))

function makeGetReq(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
  })
}

function makePostReq(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteReq(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'DELETE',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('demo-mode short-circuit (no Supabase configured)', () => {
  it('GET returns 200 + [] for a plain array response', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    const res = await GET(makeGetReq('http://localhost:3000/api/notifications'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET returns 200 + pagination envelope when limit+cursor are set', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    const res = await GET(makeGetReq('http://localhost:3000/api/notifications?limit=200&cursor=x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ data: [], nextCursor: null })
  })

  it('POST returns 503 with demo-mode message (before Zod validation)', async () => {
    const { POST } = await import('@/app/api/notifications/route')
    // Empty body — would fail Zod validation if the demo check
    // weren't placed before validateBody.
    const res = await POST(makePostReq('http://localhost:3000/api/notifications', {}))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/demo mode/i)
  })

  it('POST returns 503 even with a malformed body (demo check fires first)', async () => {
    const { POST } = await import('@/app/api/notifications/route')
    const res = await POST(
      makePostReq('http://localhost:3000/api/notifications', { invalid: true })
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/demo mode/i)
  })

  it('DELETE returns 503 with demo-mode message', async () => {
    const { DELETE } = await import('@/app/api/notifications/route')
    const res = await DELETE(makeDeleteReq('http://localhost:3000/api/notifications?id=test'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/demo mode/i)
  })

  it('GET /api/projects returns 200 + [] (hand-written route, demo guard)', async () => {
    const { GET } = await import('@/app/api/projects/route')
    const res = await GET(makeGetReq('http://localhost:3000/api/projects'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/user-projects returns 200 + [] (hand-written route, demo guard)', async () => {
    const { GET } = await import('@/app/api/user-projects/route')
    const res = await GET(makeGetReq('http://localhost:3000/api/user-projects'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/health returns 200 + status:degraded (not 503) in demo mode', async () => {
    const { GET } = await import('@/app/api/health/route')
    // Health GET takes no args (no auth, no query params)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks.supabase.configured).toBe(false)
  })
})
