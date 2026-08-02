/**
 * Bikram Sambat (BS) calendar utilities.
 * Nepal uses the Bikram Sambat calendar (≈57 years ahead of AD).
 *
 * Conversion is backed by a year-by-year lookup table (BS_YEAR_DAYS) covering
 * BS 2080–2090. The epoch is BS 2080 Baisakh 1 = April 14, 2023 AD.
 * For dates outside the supported range, we fall back to an approximate
 * year-only conversion so callers still get a reasonable value.
 */

// BS month names in Devanagari and transliterated
export const BS_MONTHS = [
  { np: 'बैशाख', en: 'Baisakh', days: 31 },
  { np: 'जेठ', en: 'Jestha', days: 31 },
  { np: 'असार', en: 'Ashadh', days: 32 },
  { np: 'साउन', en: 'Shrawan', days: 31 },
  { np: 'भदौ', en: 'Bhadra', days: 30 },
  { np: 'असोज', en: 'Ashwin', days: 30 },
  { np: 'कार्तिक', en: 'Kartik', days: 30 },
  { np: 'मंसिर', en: 'Mangsir', days: 29 },
  { np: 'पुष', en: 'Poush', days: 29 },
  { np: 'माघ', en: 'Magh', days: 30 },
  { np: 'फागुन', en: 'Falgun', days: 29 },
  { np: 'चैत', en: 'Chaitra', days: 30 },
]

export const BS_MONTHS_SHORT = [
  'Bai',
  'Jes',
  'Ash',
  'Shr',
  'Bha',
  'Ash',
  'Kar',
  'Man',
  'Pou',
  'Mag',
  'Fal',
  'Cha',
]

// AD month names
export const AD_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const AD_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export type CalendarSystem = 'BS' | 'AD'

export interface FormattedDate {
  full: string
  short: string
  year: number
  month: number
  day: number
  monthName: string
  monthNameShort: string
}

// ─── BS year lookup table ───────────────────────────────────────────────────
/**
 * Exact month-length table for BS years 2080–2090.
 * Each entry is an array of 12 integers (days per month, Baisakh→Chaitra).
 *
 * The epoch (BS 2080 Baisakh 1) corresponds to April 14, 2023 AD.
 */
export const BS_YEAR_DAYS: Record<number, number[]> = {
  2080: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2081: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2085: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2086: [30, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2089: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 30],
  2090: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
}

/** Earliest BS year covered by the lookup table. */
export const BS_YEAR_MIN = 2080
/** Latest BS year covered by the lookup table. */
export const BS_YEAR_MAX = 2090

/** Epoch: BS 2080 Baisakh 1 = April 14, 2023 AD (UTC — date arithmetic is
 *  done in local time but the epoch reference is anchored to this date). */
const BS_EPOCH_AD = new Date(2023, 3, 14) // April 14, 2023 (local time)

/**
 * Total number of days in a BS year. Returns 0 for unsupported years.
 */
export function getBsYearDays(bsYear: number): number {
  const months = BS_YEAR_DAYS[bsYear]
  if (!months) return 0
  return months.reduce((s, d) => s + d, 0)
}

/**
 * Number of days in a specific BS month (1-indexed: 1=Baisakh, 12=Chaitra).
 * Returns 0 if the year is unsupported or the month is out of range.
 */
export function getBsMonthDays(bsYear: number, bsMonth: number): number {
  const months = BS_YEAR_DAYS[bsYear]
  if (!months) return 0
  if (bsMonth < 1 || bsMonth > 12) return 0
  return months[bsMonth - 1]
}

/**
 * Whether the given BS year has a month-length entry in the lookup table.
 */
export function isBsYearSupported(bsYear: number): boolean {
  return bsYear >= BS_YEAR_MIN && bsYear <= BS_YEAR_MAX
}

/**
 * Walk forward from the BS epoch to find the BS year/month/day that
 * corresponds to the given AD date.
 *
 * Returns null if the AD date falls outside the supported BS range
 * (before April 14, 2023 AD or after the last day of BS 2090).
 */
export function adToBs(date: Date): { year: number; month: number; day: number } | null {
  // Use local midnight on the same calendar date to avoid UTC offset drift.
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const epoch = new Date(BS_EPOCH_AD.getFullYear(), BS_EPOCH_AD.getMonth(), BS_EPOCH_AD.getDate())
  if (target.getTime() < epoch.getTime()) return null

  // Diff in days, accounting for DST by using UTC noon comparisons.
  const msPerDay = 24 * 60 * 60 * 1000
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(epoch.getFullYear(), epoch.getMonth(), epoch.getDate())
  let remaining = Math.round((a - b) / msPerDay)

  let bsYear = BS_YEAR_MIN
  while (bsYear <= BS_YEAR_MAX) {
    const yearDays = getBsYearDays(bsYear)
    if (remaining < yearDays) break
    remaining -= yearDays
    bsYear++
  }
  if (bsYear > BS_YEAR_MAX) return null

  const months = BS_YEAR_DAYS[bsYear]
  let bsMonth = 0 // 0-indexed internally
  while (bsMonth < 12 && remaining >= months[bsMonth]) {
    remaining -= months[bsMonth]
    bsMonth++
  }
  if (bsMonth >= 12) return null

  return { year: bsYear, month: bsMonth + 1, day: remaining + 1 }
}

/**
 * Reverse conversion: BS year/month/day → AD Date (local midnight).
 *
 * bsMonth is 1-indexed (1=Baisakh, 12=Chaitra). Returns null if the input
 * falls outside the supported BS range.
 */
export function bsToAd(bsYear: number, bsMonth: number, bsDay: number): Date | null {
  if (!isBsYearSupported(bsYear)) return null
  if (bsMonth < 1 || bsMonth > 12) return null
  const months = BS_YEAR_DAYS[bsYear]
  if (bsDay < 1 || bsDay > months[bsMonth - 1]) return null

  const epoch = new Date(BS_EPOCH_AD.getFullYear(), BS_EPOCH_AD.getMonth(), BS_EPOCH_AD.getDate())
  let offsetDays = 0
  for (let y = BS_YEAR_MIN; y < bsYear; y++) offsetDays += getBsYearDays(y)
  for (let m = 0; m < bsMonth - 1; m++) offsetDays += months[m]
  offsetDays += bsDay - 1

  const result = new Date(epoch.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  return new Date(result.getFullYear(), result.getMonth(), result.getDate())
}

/**
 * Convert AD year to BS year (approximate).
 * BS new year falls around April 13-14.
 * If the AD date is on or after April (month >= 4), BS year = AD year + 57
 * If before April, BS year = AD year + 56 (still in previous BS year)
 *
 * @deprecated Prefer adToBs() for exact year/month/day conversion. This
 *             helper is retained for callers that only need the year and
 *             want to avoid the lookup-table dependency.
 */
export function adToBsYear(adYear: number, adMonth: number): number {
  // Month is 1-indexed (1=January, 4=April, 7=July)
  if (adMonth >= 4) {
    return adYear + 57 // After April → new BS year
  }
  return adYear + 56 // Before April → still previous BS year
}

/**
 * Convert BS year to AD year (approximate).
 */
export function bsToAdYear(bsYear: number): number {
  return bsYear - 57
}

/**
 * Format a date in BS or AD calendar.
 *
 * For BS, uses the proper adToBs() conversion when the date falls inside
 * the supported range (BS 2080–2090). Falls back to the approximate
 * year-only conversion for out-of-range dates so callers always get a
 * formatted string.
 */
export function formatDate(
  date: Date,
  calendar: CalendarSystem = 'AD',
  locale: string = 'en'
): FormattedDate {
  const adYear = date.getFullYear()
  const adMonth = date.getMonth() // 0-indexed
  const day = date.getDate()

  if (calendar === 'BS') {
    const exact = adToBs(date)
    if (exact) {
      const monthIdx = exact.month - 1
      const monthInfo = BS_MONTHS[monthIdx]
      if (locale === 'np') {
        return {
          full: `${exact.day} ${monthInfo.np} ${exact.year}`,
          short: `${exact.day} ${BS_MONTHS_SHORT[monthIdx]} ${exact.year}`,
          year: exact.year,
          month: monthIdx,
          day: exact.day,
          monthName: monthInfo.np,
          monthNameShort: BS_MONTHS_SHORT[monthIdx],
        }
      }
      return {
        full: `${exact.day} ${monthInfo.en} ${exact.year}`,
        short: `${exact.day} ${BS_MONTHS_SHORT[monthIdx]} ${exact.year}`,
        year: exact.year,
        month: monthIdx,
        day: exact.day,
        monthName: monthInfo.en,
        monthNameShort: BS_MONTHS_SHORT[monthIdx],
      }
    }

    // Out-of-range fallback: approximate year/month from the simple heuristic.
    const bsYear = adToBsYear(adYear, adMonth + 1)
    const bsMonth = (adMonth + 9) % 12 // April (3) → BS month 0 (Baisakh)
    const monthInfo = BS_MONTHS[bsMonth]

    if (locale === 'np') {
      return {
        full: `${day} ${monthInfo.np} ${bsYear}`,
        short: `${day} ${BS_MONTHS_SHORT[bsMonth]} ${bsYear}`,
        year: bsYear,
        month: bsMonth,
        day,
        monthName: monthInfo.np,
        monthNameShort: BS_MONTHS_SHORT[bsMonth],
      }
    }
    return {
      full: `${day} ${monthInfo.en} ${bsYear}`,
      short: `${day} ${BS_MONTHS_SHORT[bsMonth]} ${bsYear}`,
      year: bsYear,
      month: bsMonth,
      day,
      monthName: monthInfo.en,
      monthNameShort: BS_MONTHS_SHORT[bsMonth],
    }
  }

  // AD format
  if (locale === 'np') {
    // Could add Devanagari AD month names here in the future
    return {
      full: `${day} ${AD_MONTHS[adMonth]} ${adYear}`,
      short: `${day} ${AD_MONTHS_SHORT[adMonth]} ${adYear}`,
      year: adYear,
      month: adMonth,
      day,
      monthName: AD_MONTHS[adMonth],
      monthNameShort: AD_MONTHS_SHORT[adMonth],
    }
  }
  return {
    full: `${day} ${AD_MONTHS[adMonth]} ${adYear}`,
    short: `${day} ${AD_MONTHS_SHORT[adMonth]} ${adYear}`,
    year: adYear,
    month: adMonth,
    day,
    monthName: AD_MONTHS[adMonth],
    monthNameShort: AD_MONTHS_SHORT[adMonth],
  }
}

/**
 * Format a fiscal year in BS or AD.
 * Nepal's fiscal year runs from Shrawan 1 (mid-July) to Ashad end (mid-July next year).
 * e.g., FY 2082/83 BS = July 2025 to July 2026 AD
 */
export function formatFiscalYear(date: Date, calendar: CalendarSystem = 'BS'): string {
  const adYear = date.getFullYear()
  const adMonth = date.getMonth() // 0-indexed

  if (calendar === 'BS') {
    const bsYear = adToBsYear(adYear, adMonth + 1)
    // Nepal fiscal year runs Shrawan to Ashad (~mid-July to mid-July)
    // FY always = bsYear/(bsYear+1) because:
    //   March 2025 → BS 2081 → FY 2081/82 (started July 2024)
    //   July 2025 → BS 2082 → FY 2082/83 (started July 2025)
    return `${bsYear}/${((bsYear + 1) % 100).toString().padStart(2, '0')} BS`
  }

  // AD fiscal year (Nepal government uses July-June)
  if (adMonth < 6) {
    return `FY ${adYear - 1}/${(adYear % 100).toString().padStart(2, '0')}`
  }
  return `FY ${adYear}/${((adYear + 1) % 100).toString().padStart(2, '0')}`
}

/**
 * Get the current BS year (approximate, year-only).
 */
export function getCurrentBsYear(): number {
  return adToBsYear(new Date().getFullYear(), new Date().getMonth() + 1)
}
