import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ─── Parameterized CRUD route tests ────────────────────────────────────────
// For each createCrudHandler-based route, exercise the full request pipeline:
//   GET 401 — auth fails
//   POST 400 — invalid body
//   POST 200 — valid upsert via upsertWithAudit
//   POST 403 — verifyProjectAccess denies an INSERT
//   POST 500 — upsertWithAudit errors
//   DELETE 400 — missing id
//   DELETE 404 — row does not exist (RLS denies or not found)
//   DELETE 200 — success via deleteWithAudit
//
// The mock setup mirrors boq-route.test.ts. Each route under test is
// described in ROUTES below with its table name + a valid body shape
// (derived from the Zod schema in src/lib/validation.ts).

interface RouteSpec {
  name: string
  modulePath: string
  table: string
  /** Body that passes Zod validation. */
  validBody: Record<string, unknown>
  /** Invalid body that fails Zod validation (triggers 400). */
  invalidBody: Record<string, unknown>
  /** Expected HTTP status on a successful INSERT (200, except grns=201). */
  insertStatus?: number
}

const ROUTES: RouteSpec[] = [
  {
    name: 'equipment',
    modulePath: '@/app/api/equipment/route',
    table: 'equipment',
    validBody: { id: 'eq-1', name: 'Excavator' },
    invalidBody: { id: '' },
  },
  {
    name: 'qs-items',
    modulePath: '@/app/api/qs-items/route',
    table: 'qs_items',
    validBody: { id: 'qs-1', type: 'NCR', title: 'Crack in pier' },
    invalidBody: { id: 'qs-1', type: 'INVALID', title: 'x' },
  },
  {
    name: 'workers',
    modulePath: '@/app/api/workers/route',
    table: 'workers',
    validBody: { id: 'w-1', name: 'Ram Bahadur' },
    invalidBody: { id: '' },
  },
  {
    name: 'subcontractors',
    modulePath: '@/app/api/subcontractors/route',
    table: 'subcontractors',
    validBody: { id: 'sc-1', name: 'ABC Construction' },
    invalidBody: { id: '' },
  },
  {
    name: 'drawings',
    modulePath: '@/app/api/drawings/route',
    table: 'drawings',
    validBody: { id: 'dwg-1', number: 'C-001', title: 'Site Plan' },
    invalidBody: { id: 'dwg-1', number: '', title: '' },
  },
  {
    name: 'letters',
    modulePath: '@/app/api/letters/route',
    table: 'letters',
    // `type` is required (z.string().min(1)) — without it the POST would
    // fail Zod validation and return 400 instead of the expected success
    // status. Mirrors the actual letter shape used by the correspondence
    // module (Incoming / Outgoing / Site Instruction).
    validBody: { id: 'lt-1', number: 'L-001', type: 'Incoming' },
    invalidBody: { id: '' },
  },
  {
    name: 'dsr-entries',
    modulePath: '@/app/api/dsr-entries/route',
    table: 'dsr_entries',
    validBody: { id: 'dsr-1', task: 'Earthwork' },
    invalidBody: { id: '' },
  },
  {
    name: 'requisitions',
    modulePath: '@/app/api/requisitions/route',
    table: 'requisitions',
    validBody: { id: 'req-1', item: 'Cement' },
    invalidBody: { id: '' },
  },
  {
    name: 'purchase-orders',
    modulePath: '@/app/api/purchase-orders/route',
    table: 'purchase_orders',
    validBody: { id: 'po-1', vendor: 'XYZ Suppliers' },
    invalidBody: { id: '' },
  },
  {
    name: 'grns',
    modulePath: '@/app/api/grns/route',
    table: 'grns',
    validBody: { id: 'grn-1', po_id: 'po-1', vendor: 'XYZ Suppliers' },
    invalidBody: { id: '' },
    insertStatus: 201,
  },
  {
    name: 'chat-messages',
    modulePath: '@/app/api/chat-messages/route',
    table: 'chat_messages',
    validBody: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sender_id: 'client-sent',
      sender_name: 'Client User',
      content: 'Hello world',
    },
    invalidBody: { sender_id: '', sender_name: '', content: '' },
  },
  {
    name: 'drawing-annotations',
    modulePath: '@/app/api/drawing-annotations/route',
    table: 'drawing_annotations',
    validBody: {
      id: 'ann-1',
      drawing_id: 'DWG-001',
      author_id: 'user-1',
      author_name: 'Jane Engineer',
      type: 'rectangle',
      color: '#ef4444',
      stroke_width: 2,
      fabric_data: { type: 'rect', left: 10, top: 20, width: 100, height: 50 },
      x: 10,
      y: 20,
    },
    invalidBody: { id: 'ann-1', drawing_id: '', author_id: '', author_name: '' },
  },
]

// ─── Mocks ─────────────────────────────────────────────────────────────────
// All routes share the same dependency surface, so we mock once at module scope.

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
    data: { id: '1' },
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

// ─── Default mocks (re-applied before each test) ───────────────────────────

beforeEach(async () => {
  vi.clearAllMocks()

  const { requireAuth, verifyProjectAccess, requireRole, isProjectScopedTable, getPrimaryKey } =
    await import('@/lib/api-auth')
  vi.mocked(requireAuth).mockResolvedValue({ user: mockUser, error: null })
  vi.mocked(requireRole).mockReturnValue(null)
  vi.mocked(verifyProjectAccess).mockResolvedValue(true)
  vi.mocked(isProjectScopedTable).mockReturnValue(true)
  vi.mocked(getPrimaryKey).mockReturnValue('id')

  // Default userClient.from: chainable query that resolves with empty data.
  // Each test that needs different behaviour uses mockImplementationOnce.
  mockUserClient.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null }), // no existing row → INSERT
        limit: async () => ({ data: [{ id: '1' }], error: null }), // row exists for DELETE
      }),
      gt: () => ({
        order: async () => ({ data: [], error: null }),
      }),
      order: async () => ({ data: [], error: null }),
    }),
  }))
})

// ─── Parameterized tests ──────────────────────────────────────────────────

describe('createCrudHandler routes', () => {
  for (const spec of ROUTES) {
    describe(`/api/${spec.name}`, () => {
      it('GET returns 401 when auth fails', async () => {
        const { requireAuth } = await import('@/lib/api-auth')
        vi.mocked(requireAuth).mockResolvedValueOnce({
          user: null,
          error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        })

        const route = await import(spec.modulePath)
        const res = await route.GET(makeGetReq(`/api/${spec.name}`))
        expect(res.status).toBe(401)
      })

      it('POST returns 400 on an invalid body', async () => {
        const route = await import(spec.modulePath)
        const res = await route.POST(makePostReq(`/api/${spec.name}`, spec.invalidBody))
        expect(res.status).toBe(400)
      })

      it('POST returns the expected success status on a valid body', async () => {
        const route = await import(spec.modulePath)
        const res = await route.POST(makePostReq(`/api/${spec.name}`, spec.validBody))
        expect(res.status).toBe(spec.insertStatus ?? 200)
        expect(mockUpsertWithAudit).toHaveBeenCalledTimes(1)
        // Verify the handler routed to the correct table.
        expect(mockUpsertWithAudit.mock.calls[0][0]).toBe(spec.table)
      })

      it('POST returns 403 when verifyProjectAccess denies an INSERT', async () => {
        const { verifyProjectAccess } = await import('@/lib/api-auth')
        vi.mocked(verifyProjectAccess).mockResolvedValueOnce(false)

        const route = await import(spec.modulePath)
        // Use a synthetic project_id to make the verifyProjectAccess path
        // reachable. The handler only calls verifyProjectAccess for INSERTs
        // (when no pre-existing row is found).
        const bodyWithProject = {
          ...spec.validBody,
          project_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        }
        const res = await route.POST(makePostReq(`/api/${spec.name}`, bodyWithProject))

        expect(res.status).toBe(403)
        expect(mockUpsertWithAudit).not.toHaveBeenCalled()
      })

      it('POST returns 500 when upsertWithAudit errors', async () => {
        mockUpsertWithAudit.mockResolvedValueOnce({ data: null, error: 'boom' })

        const route = await import(spec.modulePath)
        const res = await route.POST(makePostReq(`/api/${spec.name}`, spec.validBody))
        expect(res.status).toBe(500)
      })

      it('DELETE returns 400 when id is missing', async () => {
        const route = await import(spec.modulePath)
        const res = await route.DELETE(makeDeleteReq(`/api/${spec.name}`))
        expect(res.status).toBe(400)
      })

      it('DELETE returns 404 when the row does not exist', async () => {
        mockUserClient.from.mockImplementationOnce(() => ({
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }))

        const route = await import(spec.modulePath)
        const res = await route.DELETE(makeDeleteReq(`/api/${spec.name}?id=nonexistent`))
        expect(res.status).toBe(404)
        expect(mockDeleteWithAudit).not.toHaveBeenCalled()
      })

      it('DELETE returns 200 and calls deleteWithAudit when the row exists', async () => {
        const route = await import(spec.modulePath)
        const res = await route.DELETE(makeDeleteReq(`/api/${spec.name}?id=row-1`))
        expect(res.status).toBe(200)
        expect(mockDeleteWithAudit).toHaveBeenCalledTimes(1)
        expect(mockDeleteWithAudit.mock.calls[0][0]).toBe(spec.table)
        expect(mockDeleteWithAudit.mock.calls[0][1]).toBe('row-1')
      })

      // chat-messages overrides sender_id / sender_name from the session.
      // Verify that the override actually fired — proves the transformBody
      // config flag is wired through the factory.
      if (spec.name === 'chat-messages') {
        it('POST overrides sender_id / sender_name from the authenticated session', async () => {
          // Use a realistic email so the sender_name derivation (local-part
          // split on . _ - then Title-case each token) is exercised:
          //   `arjun.sharma@omnisite.test` → `Arjun Sharma`
          // The default mockUser.email (`pm@omnisite.test`) only has one
          // token in its local part, which would test the Title-case step
          // but not the split-and-join step.
          const { requireAuth } = await import('@/lib/api-auth')
          vi.mocked(requireAuth).mockResolvedValueOnce({
            user: { ...mockUser, email: 'arjun.sharma@omnisite.test' },
            error: null,
          })

          const route = await import(spec.modulePath)
          await route.POST(makePostReq(`/api/${spec.name}`, spec.validBody))
          const passedRow = mockUpsertWithAudit.mock.calls[0][1] as Record<string, unknown>
          expect(passedRow.sender_id).toBe(mockUser.id)
          // sender_name is derived from the email's local part — see
          // src/app/api/chat-messages/route.ts. This matches what the
          // client-side mapSupabaseUser() in auth.tsx produces so the name
          // shown next to a freshly-posted message matches the name shown
          // on subsequent reloads.
          expect(passedRow.sender_name).toBe('Arjun Sharma')
        })
      }

      // grns returns 201 on INSERT, 200 on UPDATE.
      if (spec.name === 'grns') {
        it('POST returns 200 on UPDATE (existing row found)', async () => {
          // Override the pre-flight SELECT to return an existing row.
          mockUserClient.from.mockImplementationOnce(() => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { id: 'grn-1' }, error: null }),
              }),
            }),
          }))

          const route = await import(spec.modulePath)
          const res = await route.POST(makePostReq(`/api/${spec.name}`, spec.validBody))
          expect(res.status).toBe(200)
        })
      }
    })
  }
})
