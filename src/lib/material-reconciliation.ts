/**
 * Material reconciliation service.
 *
 * Compares theoretical consumption (from BOQ coefficients × actual qty)
 * against actual issued (from Material Issue Notes / stock_items).
 *
 * Identifies wastage, theft, and coefficient errors.
 */

export interface ReconciliationRow {
  materialCode: string
  materialName: string
  theoreticalQty: number
  actualIssuedQty: number | null
  variance: number | null
  variancePct: number | null
  status: 'OK' | 'VARIANCE' | 'NO_DATA'
}

export interface ReconciliationInput {
  taskActualQty: number
  boqItemUom: string
  // BOQ coefficients: material code → { coefficient, uom }
  coefficients: Record<string, { coefficient: number; uom: string; name: string }>
  // Actual issued: material code → qty
  actualIssued: Record<string, number>
}

/**
 * Compute material reconciliation for a task.
 *
 * Theoretical = task actual qty × BOQ coefficient
 * Actual = from material issues (MINs)
 * Variance = actual - theoretical
 * Variance % = (variance / theoretical) × 100
 */
export function computeReconciliation(
  input: ReconciliationInput,
  tolerancePct: number = 5
): ReconciliationRow[] {
  const rows: ReconciliationRow[] = []

  for (const [materialCode, coeff] of Object.entries(input.coefficients)) {
    const theoreticalQty = input.taskActualQty * coeff.coefficient
    const actualIssuedQty = input.actualIssued[materialCode] ?? null

    let variance: number | null = null
    let variancePct: number | null = null
    let status: ReconciliationRow['status'] = 'NO_DATA'

    if (actualIssuedQty !== null) {
      variance = actualIssuedQty - theoreticalQty
      variancePct = theoreticalQty > 0 ? (variance / theoreticalQty) * 100 : 0
      status = Math.abs(variancePct) <= tolerancePct ? 'OK' : 'VARIANCE'
    }

    rows.push({
      materialCode,
      materialName: coeff.name,
      theoreticalQty: Math.round(theoreticalQty * 100) / 100,
      actualIssuedQty: actualIssuedQty !== null ? Math.round(actualIssuedQty * 100) / 100 : null,
      variance: variance !== null ? Math.round(variance * 100) / 100 : null,
      variancePct: variancePct !== null ? Math.round(variancePct * 10) / 10 : null,
      status,
    })
  }

  return rows
}
