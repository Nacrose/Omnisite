/**
 * Bikram Sambat (BS) calendar utilities.
 * Nepal uses the Bikram Sambat calendar (≈57 years ahead of AD).
 *
 * This is a simplified conversion. For production-grade accuracy,
 * use a library like `nepali-date-converter` or the official calendar.
 * The BS calendar has varying month lengths, so we use a lookup table.
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

/**
 * Convert AD year to BS year (approximate).
 * BS new year falls around April 13-14.
 * If the AD date is on or after April (month >= 4), BS year = AD year + 57
 * If before April, BS year = AD year + 56 (still in previous BS year)
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
 * For BS, this is approximate (month/day are kept from AD but year is converted).
 * For production accuracy, use a proper BS date converter.
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
    const bsYear = adToBsYear(adYear, adMonth + 1)
    // Approximate BS month (BS year starts ~April 13)
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
 * Get the current BS year.
 */
export function getCurrentBsYear(): number {
  return adToBsYear(new Date().getFullYear(), new Date().getMonth() + 1)
}
