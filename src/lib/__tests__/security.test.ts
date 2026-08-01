import { describe, it, expect, vi } from 'vitest'
import { validateBody, boqItemSchema } from '@/lib/validation'
import type { AuthenticatedUser } from '@/lib/api-auth'

// ─── requireRole: demo-mode defense-in-depth ──────────────────────────────

// Mock the server-side supabase module so isServerSupabaseConfigured()
// returns true (simulating staging: Supabase IS configured AND demo mode
// is on). This is the scenario the defense-in-depth guard protects against.
vi.mock('@/lib/supabase-server', () => ({
  supabase: {},
  isServerSupabaseConfigured: () => true,
  createUserClient: () => ({}),
}))

// ─── Validation Tests ───────────────────────────────────────────────────────

describe('Input validation (zod schemas)', () => {
  it('accepts a valid BOQ item', () => {
    const valid = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Excavation in ordinary soil',
      type: 'Priced',
      qty: 1240,
      uom: 'cum',
      rate: 485,
    }
    const { data, error } = validateBody(boqItemSchema, valid)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.id).toBe('1.1.1')
    expect(data?.qty).toBe(1240)
  })

  it('rejects missing required fields', () => {
    const invalid = { id: '1.1.1' } // missing code, description
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('rejects negative qty', () => {
    const invalid = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Test',
      qty: -5,
      rate: 100,
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('rejects invalid type enum', () => {
    const invalid = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Test',
      type: 'InvalidType',
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
  })

  it('rejects invalid UUID for project_id', () => {
    const invalid = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Test',
      project_id: 'not-a-uuid',
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
  })

  it('applies defaults for optional fields', () => {
    const minimal = {
      id: '1.1.1',
      code: '1.1.1',
      description: 'Test',
    }
    const { data, error } = validateBody(boqItemSchema, minimal)
    expect(error).toBeNull()
    expect(data?.type).toBe('Priced') // default
    expect(data?.qty).toBe(0) // default
    expect(data?.rate).toBe(0) // default
    expect(data?.has_ra).toBe(false) // default
  })
})

// ─── API Client Tests ───────────────────────────────────────────────────────

describe('API client error handling', () => {
  it('ApiClientError preserves status and endpoint', async () => {
    const { ApiClientError } = await import('@/lib/api-client')
    const err = new ApiClientError('Test error', 404, 'boq')
    expect(err.status).toBe(404)
    expect(err.endpoint).toBe('boq')
    expect(err.message).toBe('Test error')
    expect(err.name).toBe('ApiClientError')
    expect(err instanceof Error).toBe(true)
  })
})

// ─── Rate Limiter Tests ─────────────────────────────────────────────────────

describe('Rate limiter', () => {
  it('allows requests under the limit (mocked)', async () => {
    // Mock @upstash/ratelimit to always allow in test env
    vi.mock('@/lib/rate-limit', () => ({
      checkRateLimit: vi.fn().mockResolvedValue(null),
    }))
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const mockReq = {
      headers: new Headers({ 'x-forwarded-for': '10.0.0.1' }),
    } as unknown as import('next/server').NextRequest
    const result = await checkRateLimit(mockReq, 'test-user-1')
    expect(result).toBeNull() // null = allowed
  })
})

// ─── requireRole: demo-mode defense-in-depth ──────────────────────────────

describe('requireRole — demo-mode defense-in-depth', () => {
  it('blocks demo users (empty accessToken) from writing when Supabase is configured', async () => {
    const { requireRole } = await import('@/lib/api-auth')
    const demoUser: AuthenticatedUser = {
      id: 'demo-user',
      email: 'demo@omnisite',
      role: 'PM',
      accessToken: '', // empty = demo user
    }
    const result = requireRole(demoUser, 'boq_items')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toContain('demo users cannot write')
  })

  it('allows real users (non-empty accessToken) with the correct role', async () => {
    const { requireRole } = await import('@/lib/api-auth')
    const realUser: AuthenticatedUser = {
      id: 'real-user-id',
      email: 'pm@omnisite.com',
      role: 'PM',
      accessToken: 'real-jwt-token',
    }
    const result = requireRole(realUser, 'boq_items')
    expect(result).toBeNull() // null = allowed
  })

  it('blocks real users with the wrong role', async () => {
    const { requireRole } = await import('@/lib/api-auth')
    const foreman: AuthenticatedUser = {
      id: 'foreman-id',
      email: 'foreman@omnisite.com',
      role: 'FOREMAN',
      accessToken: 'real-jwt-token',
    }
    // FOREMAN is not in TABLE_WRITE_ROLES['cbs_nodes'] (only PM is)
    const result = requireRole(foreman, 'cbs_nodes')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('returns 401 when user is null', async () => {
    const { requireRole } = await import('@/lib/api-auth')
    const result = requireRole(null, 'boq_items')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})
