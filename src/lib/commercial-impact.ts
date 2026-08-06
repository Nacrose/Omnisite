/**
 * Commercial impact assessment service.
 *
 * When a Site Instruction or Drawing Revision is created with commercial
 * impact flags, this service:
 *   1. Creates a commercial_impacts record
 *   2. Drafts a Variation Order (if affects_cost)
 *   3. Drafts an EOT claim (if affects_time)
 *   4. Flags linked BOQ items as SUBJECT_TO_REVISION
 */

export interface ImpactAssessmentInput {
  projectId: string
  sourceType: 'CORRESPONDENCE' | 'DRAWING' | 'NCR' | 'RFI'
  sourceId: string
  affectsBoqQuantity: boolean
  affectsCriticalPath: boolean
  affectsCost: boolean
  affectsTime: boolean
  estimatedCostImpact?: number
  estimatedTimeImpactDays?: number
}

export interface CommercialImpact {
  id: string
  impactType: 'VARIATION' | 'EOT' | 'RATE_REVISION' | 'QUANTITY_REVISION'
  status: 'OPEN' | 'ASSESSED' | 'DRAFTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  estimatedCost: number | null
  estimatedDays: number | null
}

/**
 * Assess commercial impact of a correspondence/drawing/NCR.
 * Creates commercial_impacts records and flags BOQ items.
 */
export async function assessImpact(input: ImpactAssessmentInput): Promise<CommercialImpact[]> {
  const impacts: CommercialImpact[] = []

  // Create commercial impact records via API
  if (input.affectsCost) {
    const res = await fetch('/api/commercial-impacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: input.projectId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        impact_type: 'VARIATION',
        status: 'OPEN',
        estimated_cost: input.estimatedCostImpact || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      impacts.push(data)
    }
  }

  if (input.affectsTime) {
    const res = await fetch('/api/commercial-impacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: input.projectId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        impact_type: 'EOT',
        status: 'OPEN',
        estimated_days: input.estimatedTimeImpactDays || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      impacts.push(data)
    }
  }

  if (input.affectsBoqQuantity) {
    const res = await fetch('/api/commercial-impacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: input.projectId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        impact_type: 'QUANTITY_REVISION',
        status: 'OPEN',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      impacts.push(data)
    }
  }

  return impacts
}

/**
 * Get open commercial impacts for a project.
 */
export async function getOpenImpacts(projectId: string): Promise<CommercialImpact[]> {
  const res = await fetch(`/api/commercial-impacts?projectId=${projectId}&status=OPEN`)
  if (!res.ok) return []
  return res.json()
}
