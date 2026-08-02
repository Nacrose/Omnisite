// ─── Payroll calculation helpers ─────────────────────────────────────────────
//
// Shared between the worker inspector (single-day display) and the payroll
// CSV export (multi-day pay period). Keeping the math in ONE place means
// the inspector's "Today's labour cost" can NEVER drift away from what the
// CSV export reports for the same day.
//
// Wage rates default from the worker's trade, based on DoR Norm 2075 daily
// rates / 8 hours:
//   - Mason (Skilled):     1450 NPR/day  → 181.25 NPR/hr
//   - Operator:            1200 NPR/day  → 150.00 NPR/hr
//   - Everyone else:        950 NPR/day  → 118.75 NPR/hr
//
// A worker's explicit `wageRate` (set via the Admin module) always wins.

import type { Worker } from './index'

/** Standard hours per day before OT kicks in. */
export const DEFAULT_STANDARD_HOURS = 8

/** Time-and-a-half is the Nepali Labour Rule default for OT. */
export const DEFAULT_OT_MULTIPLIER = 1.5

/**
 * Resolve a worker's hourly wage rate. Uses `worker.wageRate` when set,
 * otherwise derives a rate from the trade using DoR Norm 2075 daily rates.
 */
export function getWorkerWageRate(worker: Pick<Worker, 'wageRate' | 'trade'>): number {
  if (typeof worker.wageRate === 'number' && worker.wageRate > 0) {
    return worker.wageRate
  }
  // Trade-based default — daily rate / 8 hours.
  if (worker.trade.includes('Mason')) return 1450 / 8
  if (worker.trade.includes('Operator')) return 1200 / 8
  return 950 / 8
}

export interface DailyPayroll {
  /** Hours paid at the standard rate (≤ standardHours). */
  regularHours: number
  /** Hours paid at the OT rate (hours beyond standardHours). */
  otHours: number
  /** Hourly wage rate used for this calculation (NPR/hr). */
  wageRate: number
  /** OT multiplier applied (e.g. 1.5). */
  otMultiplier: number
  /** Standard-hours threshold (e.g. 8). */
  standardHours: number
  /** regularHours × wageRate. */
  regularPay: number
  /** otHours × wageRate × otMultiplier. */
  otPay: number
  /** regularPay + otPay. */
  totalPay: number
}

/**
 * Split a day's hours into regular + OT and compute the corresponding pay.
 *
 * - regularHours = min(hours, standardHours) — capped at the standard day.
 * - otHours      = max(0, hours - standardHours) — paid at wageRate × otMultiplier.
 * - Zero/missing hours → all pay fields are 0 (no spurious NaN/Infinity).
 */
export function computeDailyPayroll(
  worker: Pick<Worker, 'wageRate' | 'trade' | 'otMultiplier' | 'standardHours'>,
  hours: number
): DailyPayroll {
  const wageRate = getWorkerWageRate(worker)
  const otMultiplier = worker.otMultiplier ?? DEFAULT_OT_MULTIPLIER
  const standardHours = worker.standardHours ?? DEFAULT_STANDARD_HOURS
  const safeHours = Math.max(0, hours || 0)
  const regularHours = Math.min(safeHours, standardHours)
  const otHours = Math.max(0, safeHours - standardHours)
  const regularPay = regularHours * wageRate
  const otPay = otHours * wageRate * otMultiplier
  return {
    regularHours,
    otHours,
    wageRate,
    otMultiplier,
    standardHours,
    regularPay,
    otPay,
    totalPay: regularPay + otPay,
  }
}

/**
 * Enumerate every date (YYYY-MM-DD) in the inclusive [start, end] range.
 * Used by the payroll CSV export to emit one row per worker per day.
 *
 * Returns an empty array if either date is missing or the range is invalid
 * (end < start). Caps at 31 days so a misconfigured range doesn't blow up
 * the export.
 */
export function enumeratePayPeriodDays(start: string, end: string): string[] {
  if (!start || !end) return []
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return []
  if (endDate < startDate) return []
  const days: string[] = []
  const cursor = new Date(startDate)
  // Hard cap at 31 days — payroll periods shouldn't exceed a month.
  for (let i = 0; i <= 31 && cursor <= endDate; i++) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/**
 * Format an ISO date (YYYY-MM-DD) for display in toasts / UI labels.
 * Returns "12 Aug 2026" style — locale-independent so the format is stable
 * across runtimes.
 */
export function formatPayPeriodLabel(start: string, end: string): string {
  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return iso
    const months = [
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
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  }
  return `${fmt(start)} → ${fmt(end)}`
}
