import { describe, it, expect } from 'vitest'
import {
  adToBsYear,
  bsToAdYear,
  formatDate,
  formatFiscalYear,
  getCurrentBsYear,
  adToBs,
  bsToAd,
  getBsMonthDays,
  getBsYearDays,
  isBsYearSupported,
  BS_YEAR_MIN,
  BS_YEAR_MAX,
} from '@/lib/calendar'

describe('Bikram Sambat Calendar', () => {
  it('should convert AD 2025 July to BS 2082', () => {
    expect(adToBsYear(2025, 7)).toBe(2082) // July 2025 → BS 2082
  })

  it('should convert AD 2025 February to BS 2081', () => {
    expect(adToBsYear(2025, 2)).toBe(2081) // Feb 2025 → BS 2081 (before April)
  })

  it('should convert AD 2024 January to BS 2080', () => {
    expect(adToBsYear(2024, 1)).toBe(2080) // Jan 2024 → BS 2080
  })

  it('should convert BS year back to AD year', () => {
    expect(bsToAdYear(2082)).toBe(2025)
    expect(bsToAdYear(2081)).toBe(2024)
    expect(bsToAdYear(2075)).toBe(2018)
  })

  it('should format date in AD calendar', () => {
    const date = new Date(2025, 6, 15) // July 15, 2025
    const result = formatDate(date, 'AD')
    expect(result.year).toBe(2025)
    expect(result.monthName).toBe('July')
    expect(result.full).toBe('15 July 2025')
  })

  it('should format date in BS calendar with English month names', () => {
    const date = new Date(2025, 6, 15) // July 15, 2025
    const result = formatDate(date, 'BS', 'en')
    expect(result.year).toBe(2082)
    // Per the lookup table, July 15, 2025 maps to BS 2082 Shrawan 1.
    expect(result.monthName).toBe('Shrawan')
  })

  it('should format date in BS calendar with Nepali month names', () => {
    const date = new Date(2025, 6, 15) // July 15, 2025
    const result = formatDate(date, 'BS', 'np')
    expect(result.year).toBe(2082)
    expect(result.monthName).toBe('साउन')
  })

  it('should format fiscal year correctly in BS (after July)', () => {
    // July 2025 → BS year 2082, fiscal year starts mid-July
    const date = new Date(2025, 6, 20) // July 20, 2025
    const fy = formatFiscalYear(date, 'BS')
    // After July: FY = bsYear/(bsYear+1) = 2082/83
    expect(fy).toBe('2082/83 BS')
  })

  it('should format fiscal year correctly in BS (before July)', () => {
    const date = new Date(2025, 2, 15) // March 15, 2025
    expect(formatFiscalYear(date, 'BS')).toBe('2081/82 BS')
  })

  it('should format fiscal year in AD', () => {
    const date = new Date(2025, 6, 20) // July 20, 2025
    expect(formatFiscalYear(date, 'AD')).toBe('FY 2025/26')
  })

  it('should get current BS year', () => {
    const currentBs = getCurrentBsYear()
    expect(currentBs).toBeGreaterThan(2080)
    expect(currentBs).toBeLessThan(2090)
  })
})

describe('BS/AD exact conversion (lookup table)', () => {
  it('should expose the supported BS year range', () => {
    expect(BS_YEAR_MIN).toBe(2080)
    expect(BS_YEAR_MAX).toBe(2090)
  })

  it('should treat the BS epoch as April 14, 2023 AD', () => {
    const ad = new Date(2023, 3, 14) // April 14, 2023
    const bs = adToBs(ad)
    expect(bs).not.toBeNull()
    expect(bs!.year).toBe(2080)
    expect(bs!.month).toBe(1) // Baisakh
    expect(bs!.day).toBe(1)
  })

  it('should return null for AD dates before the BS epoch', () => {
    const ad = new Date(2023, 3, 13) // April 13, 2023 — one day before epoch
    expect(adToBs(ad)).toBeNull()
  })

  it('should return null for AD dates after the supported BS range', () => {
    // BS 2090 Chaitra 30 = ~April 12, 2034 AD. April 13, 2034 should be unsupported.
    const ad = new Date(2034, 3, 13)
    expect(adToBs(ad)).toBeNull()
  })

  it('should convert AD July 15, 2025 → BS 2082 Shrawan 1', () => {
    // Per the lookup table (2080=364d, 2081=365d, 2082 months [31,32,31,32,…]),
    // July 15, 2025 lands on BS 2082 Shrawan 1.
    const bs = adToBs(new Date(2025, 6, 15))
    expect(bs).toEqual({ year: 2082, month: 4, day: 1 }) // Shrawan is month 4
  })

  it('should convert a Baisakh 1 epoch date exactly', () => {
    // April 14, 2023 is the BS epoch (Baisakh 1, 2080).
    const bs = adToBs(new Date(2023, 3, 14))
    expect(bs).toEqual({ year: 2080, month: 1, day: 1 })
  })

  it('should convert a month-boundary AD date exactly (Baisakh 31 → Jestha 1)', () => {
    // Baisakh 2080 has 31 days, so Baisakh 31 = April 14 + 30 days = May 14, 2023.
    // The next day (May 15, 2023) should be Jestha 1.
    expect(adToBs(new Date(2023, 4, 14))).toEqual({ year: 2080, month: 1, day: 31 })
    expect(adToBs(new Date(2023, 4, 15))).toEqual({ year: 2080, month: 2, day: 1 })
  })

  it('should round-trip AD → BS → AD for a sample date', () => {
    const original = new Date(2025, 6, 15)
    const bs = adToBs(original)!
    const roundTripped = bsToAd(bs.year, bs.month, bs.day)!
    expect(roundTripped.getFullYear()).toBe(2025)
    expect(roundTripped.getMonth()).toBe(6) // July
    expect(roundTripped.getDate()).toBe(15)
  })

  it('should round-trip AD → BS → AD at the BS new year boundary', () => {
    // April 14, 2023 = BS 2080 Baisakh 1
    const ad = new Date(2023, 3, 14)
    const bs = adToBs(ad)!
    const roundTripped = bsToAd(bs.year, bs.month, bs.day)!
    expect(roundTripped.getFullYear()).toBe(2023)
    expect(roundTripped.getMonth()).toBe(3)
    expect(roundTripped.getDate()).toBe(14)
  })

  it('should round-trip AD → BS → AD across a year boundary (Baisakh 1 of 2081)', () => {
    // BS 2081 Baisakh 1 = April 13, 2024 AD (2081 has 366 days so 2080 ended Apr 12)
    // Find the actual AD date for BS 2081 Baisakh 1 via bsToAd, then verify adToBs inverts.
    const ad = bsToAd(2081, 1, 1)!
    const bs = adToBs(ad)!
    expect(bs).toEqual({ year: 2081, month: 1, day: 1 })
  })

  it('should handle the last day of a BS month correctly', () => {
    // BS 2080 Ashadh has 32 days (per the lookup table).
    const lastDay = bsToAd(2080, 3, 32)! // Ashadh = month 3
    const bs = adToBs(lastDay)!
    expect(bs).toEqual({ year: 2080, month: 3, day: 32 })
    // The next AD day should be Shrawan 1.
    const nextDay = new Date(lastDay)
    nextDay.setDate(lastDay.getDate() + 1)
    const bsNext = adToBs(nextDay)!
    expect(bsNext.month).toBe(4) // Shrawan
    expect(bsNext.day).toBe(1)
  })

  it('should report supported BS years correctly', () => {
    expect(isBsYearSupported(2079)).toBe(false)
    expect(isBsYearSupported(2080)).toBe(true)
    expect(isBsYearSupported(2085)).toBe(true)
    expect(isBsYearSupported(2090)).toBe(true)
    expect(isBsYearSupported(2091)).toBe(false)
  })

  it('should report month lengths from the lookup table', () => {
    // BS 2080: Baisakh=31, Ashadh=32, Shrawan=31, Chaitra=30
    expect(getBsMonthDays(2080, 1)).toBe(31)
    expect(getBsMonthDays(2080, 3)).toBe(32)
    expect(getBsMonthDays(2080, 4)).toBe(31)
    expect(getBsMonthDays(2080, 12)).toBe(30)
    // Unsupported year → 0
    expect(getBsMonthDays(2079, 1)).toBe(0)
    // Out-of-range month → 0
    expect(getBsMonthDays(2080, 0)).toBe(0)
    expect(getBsMonthDays(2080, 13)).toBe(0)
  })

  it('should report total days per BS year', () => {
    expect(getBsYearDays(2080)).toBe(364) // 2080 is short (364 days)
    expect(getBsYearDays(2081)).toBe(365)
    expect(getBsYearDays(2086)).toBe(364)
    expect(getBsYearDays(2090)).toBe(365)
    expect(getBsYearDays(2079)).toBe(0)
  })

  it('should reject invalid bsToAd inputs', () => {
    expect(bsToAd(2079, 1, 1)).toBeNull() // unsupported year
    expect(bsToAd(2080, 0, 1)).toBeNull() // month < 1
    expect(bsToAd(2080, 13, 1)).toBeNull() // month > 12
    expect(bsToAd(2080, 3, 33)).toBeNull() // Ashadh has only 32 days in 2080
  })
})
