import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/api-auth'

// ─── CSRF Origin header check tests ────────────────────────────────────────

function makeReq(method: string, origin: string | null, host = 'localhost:3000'): NextRequest {
  const headers: Record<string, string> = { host }
  if (origin !== null) headers['origin'] = origin
  return new NextRequest(new URL('http://localhost:3000/api/boq'), {
    method,
    headers,
  })
}

describe('checkOrigin — CSRF defense', () => {
  it('allows same-origin requests (Origin matches Host)', () => {
    const req = makeReq('POST', 'http://localhost:3000')
    const result = checkOrigin(req)
    expect(result).toBeNull() // null = pass
  })

  it('blocks cross-origin requests (Origin differs from Host)', () => {
    const req = makeReq('POST', 'https://evil.example.com')
    const result = checkOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('allows requests with no Origin header (same-origin / non-browser)', () => {
    const req = makeReq('POST', null)
    const result = checkOrigin(req)
    expect(result).toBeNull()
  })

  it('allows requests with no Host header (edge case)', () => {
    const headers: Record<string, string> = { origin: 'http://localhost:3000' }
    const req = new NextRequest(new URL('http://localhost:3000/api/boq'), {
      method: 'POST',
      headers,
    })
    const result = checkOrigin(req)
    expect(result).toBeNull()
  })

  it('blocks malformed Origin header', () => {
    const req = makeReq('POST', 'not-a-url')
    const result = checkOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(400)
  })

  it('blocks subdomain attacks (sub.example.com → localhost:3000)', () => {
    const req = makeReq('POST', 'http://sub.localhost:3000')
    const result = checkOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('allows HTTPS same-origin (same host, different protocol)', () => {
    // In production the Host would be the production domain; Origin
    // matches the host even if the scheme differs (http vs https).
    const req = makeReq('POST', 'https://localhost:3000', 'localhost:3000')
    const result = checkOrigin(req)
    expect(result).toBeNull()
  })
})
