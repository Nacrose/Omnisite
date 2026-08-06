// ─── Safari compatibility polyfills ──────────────────────────────────────────
//
// Safari < 15.4 (released March 2022) doesn't support:
//   - structuredClone() — used by useSyncedState seed data initializers
//   - crypto.randomUUID() — used by ID generation across the app
//
// Without these polyfills, Safari crashes during the initial render with
// ReferenceError/TypeError, leaving the user stuck on a loading spinner.
// The polyfills are safe to install unconditionally — if the native
// implementation exists, we don't override it.

// ─── structuredClone polyfill ──────────────────────────────────────────────
// Uses JSON round-trip as a fallback. This is NOT a perfect polyfill
// (it doesn't handle Date, RegExp, Map, Set, ArrayBuffer, etc.) but
// the app only uses structuredClone for plain-object seed data (arrays
// of simple records with string/number/boolean fields), so JSON
// round-trip is sufficient.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(obj: T): T => {
    if (obj === null || obj === undefined) return obj
    return JSON.parse(JSON.stringify(obj)) as T
  }
}

// ─── crypto.randomUUID polyfill ────────────────────────────────────────────
// Uses crypto.getRandomValues (available in all browsers since 2015)
// to generate a RFC 4122 v4 UUID. Falls back to Math.random if even
// that's not available (extremely unlikely).
if (
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: (): string => {
      if (typeof globalThis.crypto.getRandomValues === 'function') {
        // RFC 4122 v4 UUID via crypto.getRandomValues
        const buf = new Uint8Array(16)
        globalThis.crypto.getRandomValues(buf)
        buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
        buf[8] = (buf[8] & 0x3f) | 0x80 // variant 10
        const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0'))
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
      }
      // Last-resort fallback: Math.random (not cryptographically secure,
      // but the app doesn't use randomUUID for security — just for
      // unique record IDs that are also checked server-side).
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
    writable: false,
    configurable: false,
  })
}

export {}
