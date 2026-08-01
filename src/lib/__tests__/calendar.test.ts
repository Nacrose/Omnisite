import { describe, it, expect } from 'vitest'
import {
  adToBsYear,
  bsToAdYear,
  formatDate,
  formatFiscalYear,
  getCurrentBsYear,
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
    // July → BS month index (6+9)%12 = 3 → Shrawan
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
