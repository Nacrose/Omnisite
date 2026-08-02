import { describe, it, expect } from 'vitest'
import { translations } from '@/lib/i18n'

// True parity tests — import the real `translations` object and verify
// the English and Nepali dictionaries are kept in sync.
// Catches the common bug where a new key is added to English but the
// Nepali translation is forgotten (or vice versa).

const en = translations.en
const np = translations.np

describe('i18n translation parity (real dictionary)', () => {
  it('both locales export non-empty dictionaries', () => {
    expect(Object.keys(en).length).toBeGreaterThan(0)
    expect(Object.keys(np).length).toBeGreaterThan(0)
  })

  it('en and np expose the exact same set of keys', () => {
    const enKeys = new Set(Object.keys(en))
    const npKeys = new Set(Object.keys(np))

    const missingFromNp = [...enKeys].filter((k) => !npKeys.has(k))
    const missingFromEn = [...npKeys].filter((k) => !enKeys.has(k))

    expect(missingFromNp).toEqual([])
    expect(missingFromEn).toEqual([])
  })

  it('en and np have the same key count', () => {
    expect(Object.keys(en).length).toBe(Object.keys(np).length)
  })

  it('no translation is an empty string', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key} should not be empty`).not.toBe('')
    }
    for (const [key, value] of Object.entries(np)) {
      expect(value, `np.${key} should not be empty`).not.toBe('')
    }
  })

  it('no Nepali translation is just a copy of the English value (catches forgotten translations)', () => {
    // Nepali translations should not equal their English counterpart — that
    // would indicate someone copied the en value as a placeholder. We only
    // flag pure ASCII English strings (skip codes like "BS", "AD", "EAC",
    // "RFI", "NCR" that are intentionally identical across locales).
    const intentionalSharedTokens = new Set([
      'RFI',
      'NCR',
      'GRN',
      'EAC',
      'PDF',
      'CSV',
      'PO',
      'DSR+Exp',
      'BS',
      'AD',
      'FY',
    ])

    for (const key of Object.keys(en)) {
      const enVal = en[key]
      const npVal = np[key]
      // Skip keys whose English value is a single token shared across locales.
      if (intentionalSharedTokens.has(enVal)) continue
      // Only flag pure-ASCII English values (Nepali script is non-ASCII).
      if (!/[a-z]/i.test(enVal)) continue
      // Nepali translations should contain Devanagari (U+0900–U+097F) or be
      // a meaningful translation; an identical ASCII English value signals
      // a forgotten translation.
      if (npVal === enVal && /^[\x00-\x7F]+$/.test(npVal)) {
        // Allow short technical tokens (<=3 chars) to be shared.
        if (enVal.length <= 3) continue
        // Allow tokens inside the intentional shared set (e.g. "RFI Register"
        // — the word "RFI" is shared, but the rest is Nepali).
        const hasNepali = /[\u0900-\u097F]/.test(npVal)
        if (!hasNepali) {
          throw new Error(
            `np.${key} is identical to en value "${enVal}" — likely a forgotten translation`
          )
        }
      }
    }
  })

  it('no translation contains an unresolved placeholder', () => {
    // Placeholders look like {name} or {count}. Translations should not ship
    // with literal placeholders that the t() function would leave behind if
    // no params were passed.
    const placeholderRe = /\{[a-zA-Z0-9_]+\}/
    for (const [key, value] of Object.entries(en)) {
      expect(placeholderRe.test(value), `en.${key} contains an unresolved placeholder`).toBe(false)
    }
    for (const [key, value] of Object.entries(np)) {
      expect(placeholderRe.test(value), `np.${key} contains an unresolved placeholder`).toBe(false)
    }
  })

  it('every key uses the namespace.key dot notation', () => {
    const keyRe = /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+$/
    for (const key of Object.keys(en)) {
      expect(key, `en key "${key}" should match dot notation`).toMatch(keyRe)
    }
    for (const key of Object.keys(np)) {
      expect(key, `np key "${key}" should match dot notation`).toMatch(keyRe)
    }
  })
})
