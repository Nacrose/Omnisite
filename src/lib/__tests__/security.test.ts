import { describe, it, expect } from 'vitest'
import { validateBody, boqItemSchema } from '@/lib/validation'

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
      id: '1.1.1', code: '1.1.1', description: 'Test', qty: -5, rate: 100,
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('rejects invalid type enum', () => {
    const invalid = {
      id: '1.1.1', code: '1.1.1', description: 'Test', type: 'InvalidType',
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
  })

  it('rejects invalid UUID for project_id', () => {
    const invalid = {
      id: '1.1.1', code: '1.1.1', description: 'Test', project_id: 'not-a-uuid',
    }
    const { data, error } = validateBody(boqItemSchema, invalid)
    expect(error).not.toBeNull()
  })

  it('applies defaults for optional fields', () => {
    const minimal = {
      id: '1.1.1', code: '1.1.1', description: 'Test',
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
  it('allows requests under the limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const mockReq = {
      headers: new Headers({ 'x-forwarded-for': '10.0.0.1' }),
    } as unknown as import('next/server').NextRequest
    const result = await checkRateLimit(mockReq, 'test-user-1')
    expect(result).toBeNull() // null = allowed
  })
})
