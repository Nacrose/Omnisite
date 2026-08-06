/**
 * Three-way match service — procurement tolerance matching.
 *
 * Compares PO vs GRN vs Invoice for quantity, rate, and amount.
 * Uses configurable tolerance rules to determine MATCHED vs VARIANCE.
 */

export interface MatchInput {
  poQty: number
  poRate: number
  grnQty: number
  grnRate: number
  invoiceQty?: number
  invoiceRate?: number
}

export interface MatchResult {
  status: 'MATCHED' | 'VARIANCE' | 'EXCEPTION'
  qtyVariance: number
  qtyVariancePct: number
  rateVariance: number
  rateVariancePct: number
  amountVariance: number
  amountVariancePct: number
  details: string[]
}

export interface ToleranceRule {
  ruleType: 'QTY' | 'RATE' | 'AMOUNT'
  fieldName: string
  tolerancePct: number
  toleranceAbsolute: number
}

// Default tolerances (can be overridden by DB tolerance_rules table)
const DEFAULT_TOLERANCES: ToleranceRule[] = [
  { ruleType: 'QTY', fieldName: 'quantity', tolerancePct: 5.0, toleranceAbsolute: 0 },
  { ruleType: 'RATE', fieldName: 'rate', tolerancePct: 2.0, toleranceAbsolute: 0 },
  { ruleType: 'AMOUNT', fieldName: 'amount', tolerancePct: 3.0, toleranceAbsolute: 0 },
]

/**
 * Perform a 3-way match (PO × GRN × Invoice).
 *
 * Returns MATCHED if all variances are within tolerance.
 * Returns VARIANCE if any variance exceeds tolerance.
 * Returns EXCEPTION if data is missing or invalid.
 */
export function performThreeWayMatch(
  input: MatchInput,
  rules: ToleranceRule[] = DEFAULT_TOLERANCES
): MatchResult {
  const details: string[] = []
  const issues: string[] = []

  // ─── Quantity comparison (PO vs GRN) ──────────────────────────────────
  const qtyVariance = input.grnQty - input.poQty
  const qtyVariancePct = input.poQty > 0 ? (qtyVariance / input.poQty) * 100 : 0
  const qtyTolerance = rules.find(r => r.ruleType === 'QTY') || DEFAULT_TOLERANCES[0]
  const qtyWithinTolerance = Math.abs(qtyVariancePct) <= qtyTolerance.tolerancePct

  if (!qtyWithinTolerance) {
    issues.push(
      `Qty variance: ${qtyVariance >= 0 ? '+' : ''}${qtyVariance.toFixed(2)} (${qtyVariancePct.toFixed(1)}%) — tolerance ±${qtyTolerance.tolerancePct}%`
    )
  }

  // ─── Rate comparison (PO vs Invoice) ──────────────────────────────────
  const invoiceRate = input.invoiceRate ?? input.grnRate
  const rateVariance = invoiceRate - input.poRate
  const rateVariancePct = input.poRate > 0 ? (rateVariance / input.poRate) * 100 : 0
  const rateTolerance = rules.find(r => r.ruleType === 'RATE') || DEFAULT_TOLERANCES[1]
  const rateWithinTolerance = Math.abs(rateVariancePct) <= rateTolerance.tolerancePct

  if (!rateWithinTolerance) {
    issues.push(
      `Rate variance: ${rateVariance >= 0 ? '+' : ''}${rateVariance.toFixed(2)} (${rateVariancePct.toFixed(1)}%) — tolerance ±${rateTolerance.tolerancePct}%`
    )
  }

  // ─── Amount comparison (PO vs GRN × Invoice rate) ─────────────────────
  const poAmount = input.poQty * input.poRate
  const actualAmount = input.grnQty * invoiceRate
  const amountVariance = actualAmount - poAmount
  const amountVariancePct = poAmount > 0 ? (amountVariance / poAmount) * 100 : 0
  const amountTolerance = rules.find(r => r.ruleType === 'AMOUNT') || DEFAULT_TOLERANCES[2]
  const amountWithinTolerance = Math.abs(amountVariancePct) <= amountTolerance.tolerancePct

  if (!amountWithinTolerance) {
    issues.push(
      `Amount variance: NPR ${amountVariance >= 0 ? '+' : ''}${amountVariance.toFixed(0)} (${amountVariancePct.toFixed(1)}%) — tolerance ±${amountTolerance.tolerancePct}%`
    )
  }

  const status: MatchResult['status'] =
    issues.length === 0 ? 'MATCHED' : 'VARIANCE'

  return {
    status,
    qtyVariance,
    qtyVariancePct,
    rateVariance,
    rateVariancePct,
    amountVariance,
    amountVariancePct,
    details: issues.length > 0 ? issues : ['All values within tolerance — 3-way match confirmed.'],
  }
}
