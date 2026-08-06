/**
 * Productivity variance service.
 *
 * Computes planned vs actual manhours per task, calculates variance %,
 * and flags tasks exceeding the threshold for root-cause logging.
 */

export type RootCauseCode =
  | 'WEATHER' | 'MATERIAL_DELAY' | 'DRAWING_DELAY' | 'REWORK'
  | 'LOW_SKILL' | 'EQUIPMENT_BREAKDOWN' | 'SITE_ACCESS' | 'SUPERVISION' | 'OTHER'

export interface ProductivityResult {
  taskId: string
  calculationDate: string
  plannedManhours: number
  actualManhours: number
  varianceManhours: number
  variancePercent: number
  productivityRatio: number
  rootCauseCode: RootCauseCode | null
  status: 'OK' | 'ROOT_CAUSE_REQUIRED' | 'ROOT_CAUSE_LOGGED'
}

export interface ProductivityInput {
  taskId: string
  calculationDate: string
  plannedManhours: number
  actualManhours: number
}

export const PRODUCTIVITY_VARIANCE_THRESHOLD = 20 // %

export const ROOT_CAUSE_LABELS: Record<RootCauseCode, string> = {
  WEATHER: 'Weather (rain, fog, extreme heat)',
  MATERIAL_DELAY: 'Material delivery delay',
  DRAWING_DELAY: 'Drawing approval / revision delay',
  REWORK: 'Rework due to quality issue',
  LOW_SKILL: 'Low skill / productivity of workforce',
  EQUIPMENT_BREAKDOWN: 'Equipment breakdown',
  SITE_ACCESS: 'Site access restriction',
  SUPERVISION: 'Inadequate supervision',
  OTHER: 'Other (specify in notes)',
}

/**
 * Compute productivity variance for a task.
 *
 * If variance_percent > threshold, status = ROOT_CAUSE_REQUIRED.
 * If root_cause_code is set, status = ROOT_CAUSE_LOGGED.
 */
export function computeProductivity(
  input: ProductivityInput,
  rootCauseCode: RootCauseCode | null = null
): ProductivityResult {
  const varianceManhours = input.actualManhours - input.plannedManhours
  const variancePercent = input.plannedManhours > 0
    ? (varianceManhours / input.plannedManhours) * 100
    : 0
  const productivityRatio = input.actualManhours > 0
    ? input.plannedManhours / input.actualManhours
    : 1

  let status: ProductivityResult['status'] = 'OK'
  if (Math.abs(variancePercent) > PRODUCTIVITY_VARIANCE_THRESHOLD) {
    status = rootCauseCode ? 'ROOT_CAUSE_LOGGED' : 'ROOT_CAUSE_REQUIRED'
  }

  return {
    taskId: input.taskId,
    calculationDate: input.calculationDate,
    plannedManhours: input.plannedManhours,
    actualManhours: input.actualManhours,
    varianceManhours: Math.round(varianceManhours * 10) / 10,
    variancePercent: Math.round(variancePercent * 10) / 10,
    productivityRatio: Math.round(productivityRatio * 100) / 100,
    rootCauseCode,
    status,
  }
}

/**
 * Save a productivity result to the API.
 */
export async function saveProductivityResult(
  projectId: string,
  result: ProductivityResult
): Promise<boolean> {
  const res = await fetch('/api/productivity-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      task_id: result.taskId,
      calculation_date: result.calculationDate,
      planned_manhours: result.plannedManhours,
      actual_manhours: result.actualManhours,
      variance_manhours: result.varianceManhours,
      variance_percent: result.variancePercent,
      productivity_ratio: result.productivityRatio,
      root_cause_code: result.rootCauseCode,
      status: result.status,
    }),
  })
  return res.ok
}
