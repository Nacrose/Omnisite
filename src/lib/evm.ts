/**
 * EVM (Earned Value Management) service.
 *
 * Computes BCWS, BCWP, ACWP, SPI, CPI, EAC from:
 * - BOQ item (rate × qty) → BCWS (Planned Value)
 * - Task progress % → BCWP (Earned Value)
 * - CBS actuals → ACWP (Actual Cost)
 */

export interface EVMInput {
  boqRate: number
  boqQty: number
  taskProgress: number // 0-100
  actualCost?: number // from CBS (optional — if not available, CPI can't be computed)
}

export interface EVMResult {
  bcws: number  // Planned Value
  bcwp: number  // Earned Value
  acwp: number | null  // Actual Cost
  sv: number   // Schedule Variance (BCWP - BCWS)
  cv: number | null  // Cost Variance (BCWP - ACWP)
  spi: number  // Schedule Performance Index (BCWP / BCWS)
  cpi: number | null  // Cost Performance Index (BCWP / ACWP)
  eac: number | null  // Estimate at Completion (BCWS / CPI)
  vac: number | null  // Variance at Completion (BCWS - EAC)
  isBehindSchedule: boolean
  isOverBudget: boolean | null
}

/**
 * Compute EVM metrics from BOQ + task progress + actual cost.
 *
 * Returns null fields where data is insufficient (e.g. ACWP without CBS).
 */
export function computeEVM(input: EVMInput): EVMResult {
  const bcws = input.boqRate * input.boqQty
  const bcwp = bcws * (input.taskProgress / 100)
  const acwp = input.actualCost ?? null

  const sv = bcwp - bcws
  const spi = bcws > 0 ? bcwp / bcws : 0

  const cv = acwp !== null ? bcwp - acwp : null
  const cpi = acwp !== null && acwp > 0 ? bcwp / acwp : null
  const eac = cpi !== null && cpi > 0 ? bcws / cpi : null
  const vac = eac !== null ? bcws - eac : null

  return {
    bcws: Math.round(bcws),
    bcwp: Math.round(bcwp),
    acwp: acwp !== null ? Math.round(acwp) : null,
    sv: Math.round(sv),
    cv: cv !== null ? Math.round(cv) : null,
    spi: Math.round(spi * 100) / 100,
    cpi: cpi !== null ? Math.round(cpi * 100) / 100 : null,
    eac: eac !== null ? Math.round(eac) : null,
    vac: vac !== null ? Math.round(vac) : null,
    isBehindSchedule: sv < 0,
    isOverBudget: cv !== null ? cv < 0 : null,
  }
}

/**
 * Format EVM metrics for display.
 */
export function formatEVM(result: EVMResult): { label: string; value: string; status: 'good' | 'bad' | 'neutral' }[] {
  const fmt = (n: number) => `NPR ${n.toLocaleString()}`
  const fmtPct = (n: number) => n.toFixed(2)

  return [
    { label: 'BCWS (Planned Value)', value: fmt(result.bcws), status: 'neutral' },
    { label: 'BCWP (Earned Value)', value: fmt(result.bcwp), status: 'neutral' },
    {
      label: 'ACWP (Actual Cost)',
      value: result.acwp !== null ? fmt(result.acwp) : '—',
      status: 'neutral',
    },
    {
      label: 'SV (Schedule Variance)',
      value: `${result.sv >= 0 ? '+' : ''}${fmt(result.sv)}`,
      status: result.isBehindSchedule ? 'bad' : 'good',
    },
    {
      label: 'CV (Cost Variance)',
      value: result.cv !== null ? `${result.cv >= 0 ? '+' : ''}${fmt(result.cv)}` : '—',
      status: result.isOverBudget === null ? 'neutral' : result.isOverBudget ? 'bad' : 'good',
    },
    {
      label: 'SPI (Schedule Perf.)',
      value: fmtPct(result.spi),
      status: result.spi < 1 ? 'bad' : 'good',
    },
    {
      label: 'CPI (Cost Perf.)',
      value: result.cpi !== null ? fmtPct(result.cpi) : '—',
      status: result.cpi === null ? 'neutral' : result.cpi < 1 ? 'bad' : 'good',
    },
    {
      label: 'EAC (Estimate at Completion)',
      value: result.eac !== null ? fmt(result.eac) : '—',
      status: 'neutral',
    },
  ]
}
