import { describe, it, expect } from 'vitest'
import { __test__ } from '@/proxy'

const { buildCspHeader, STATIC_SECURITY_HEADERS } = __test__

// ─── buildCspHeader ─────────────────────────────────────────────────────────
//
// The CSP header is the primary XSS defense for an app that renders
// user-generated content (chat messages, DSR remarks, letter bodies). These
// tests lock down the security-relevant invariants:
//   1. `script-src` must NOT contain 'unsafe-inline' or 'unsafe-eval'.
//   2. `script-src` MUST contain a 'nonce-<value>' directive.
//   3. The nonce must be present verbatim in the header (no escaping bugs).
//   4. `frame-ancestors 'none'` must be set (clickjacking defense).
//   5. `default-src 'self'` must be the first directive (fallback baseline).

describe('buildCspHeader', () => {
  it('includes a nonce in script-src', () => {
    const nonce = 'abc-123-def-456'
    const csp = buildCspHeader(nonce)
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}'`)
  })

  it('does NOT include unsafe-inline in script-src', () => {
    const csp = buildCspHeader('test-nonce')
    // Extract the script-src directive and assert it doesn't contain
    // 'unsafe-inline'. We test the directive in isolation so that
    // 'unsafe-inline' in style-src (which is allowed) doesn't false-positive.
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/)
    expect(scriptSrcMatch).not.toBeNull()
    if (scriptSrcMatch) {
      const scriptSrc = scriptSrcMatch[1]
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    }
  })

  it('does NOT include unsafe-eval in script-src', () => {
    const csp = buildCspHeader('test-nonce')
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/)
    expect(scriptSrcMatch).not.toBeNull()
    if (scriptSrcMatch) {
      const scriptSrc = scriptSrcMatch[1]
      expect(scriptSrc).not.toContain("'unsafe-eval'")
    }
  })

  it("sets frame-ancestors to 'none'", () => {
    const csp = buildCspHeader('test-nonce')
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it("sets default-src to 'self' as the first directive", () => {
    const csp = buildCspHeader('test-nonce')
    expect(csp.startsWith("default-src 'self'")).toBe(true)
  })

  it('preserves the nonce verbatim (no escaping or truncation)', () => {
    // Use a nonce with characters that could trip up regex/HTML escaping
    const nonce = 'a+b=c/d*e'
    const csp = buildCspHeader(nonce)
    expect(csp).toContain(`'nonce-${nonce}'`)
  })

  it('produces a different header for different nonces', () => {
    const csp1 = buildCspHeader('nonce-one')
    const csp2 = buildCspHeader('nonce-two')
    expect(csp1).not.toEqual(csp2)
  })

  it('includes HSTS with preload in static security headers', () => {
    const hsts = STATIC_SECURITY_HEADERS['Strict-Transport-Security']
    expect(hsts).toContain('max-age=63072000')
    expect(hsts).toContain('includeSubDomains')
    expect(hsts).toContain('preload')
  })

  it('sets X-Frame-Options to DENY', () => {
    expect(STATIC_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(STATIC_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })

  it('locks down Permissions-Policy (camera, microphone, geolocation)', () => {
    const pp = STATIC_SECURITY_HEADERS['Permissions-Policy']
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })

  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    expect(STATIC_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})
