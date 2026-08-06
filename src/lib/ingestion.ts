/**
 * Ingestion parser service.
 *
 * Accepts raw payloads (JSON, CSV-like) from field sources and creates
 * ingestion_drafts for validation. LLM output must NEVER become an official
 * record directly — it always creates a PENDING_VALIDATION draft.
 */

export type DraftType = 'DSR' | 'EQUIPMENT_LOG' | 'MATERIAL_RECEIPT' | 'MANPOWER_ATTENDANCE' | 'RFI' | 'SITE_NOTE' | 'CORRESPONDENCE'

export interface IngestionBatch {
  id: string
  projectId: string
  sourceType: string
  status: 'RECEIVED' | 'PARSING' | 'READY' | 'FAILED' | 'COMPLETED'
  rawPayload: Record<string, unknown>
}

export interface IngestionDraft {
  id: string
  batchId: string
  draftType: DraftType
  extractedData: Record<string, unknown>
  confidenceScore: number | null
  validationStatus: 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'CONVERTED'
  convertedEntityType?: string
  convertedEntityId?: string
}

/**
 * Submit raw data for ingestion. Creates a batch + draft.
 */
export async function submitIngestion(
  projectId: string,
  sourceType: string,
  payload: Record<string, unknown>,
  draftType: DraftType
): Promise<{ batchId: string; draftId: string } | null> {
  const res = await fetch('/api/ingestion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sourceType, payload, draftType }),
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Parse a batch's raw payload into structured drafts.
 * Rule-based parser first; LLM can be added later.
 */
export function parsePayload(
  sourceType: string,
  payload: Record<string, unknown>
): { draftType: DraftType; extractedData: Record<string, unknown>; confidence: number } {
  // Rule-based extraction — map known field names to structured data
  const extracted: Record<string, unknown> = {}

  // Common field mappings
  if (payload.date) extracted.date = payload.date
  if (payload.task) extracted.task = payload.task
  if (payload.chainage) extracted.chainage = payload.chainage
  if (payload.qty) extracted.qty = Number(payload.qty)
  if (payload.uom) extracted.uom = payload.uom
  if (payload.remarks) extracted.remarks = payload.remarks
  if (payload.progress) extracted.progress = Number(payload.progress)

  // Detect draft type from source
  let draftType: DraftType = 'SITE_NOTE'
  if (sourceType.includes('dsr') || payload.planned || payload.actual) {
    draftType = 'DSR'
  } else if (sourceType.includes('rfi') || payload.question) {
    draftType = 'RFI'
  } else if (sourceType.includes('manpower') || payload.workers) {
    draftType = 'MANPOWER_ATTENDANCE'
  } else if (sourceType.includes('equipment') || payload.hours) {
    draftType = 'EQUIPMENT_LOG'
  } else if (sourceType.includes('material') || payload.received) {
    draftType = 'MATERIAL_RECEIPT'
  }

  // Confidence: high if we extracted ≥3 known fields, medium for 1-2
  const fieldCount = Object.keys(extracted).length
  const confidence = fieldCount >= 3 ? 0.9 : fieldCount >= 1 ? 0.6 : 0.3

  return { draftType, extractedData: extracted, confidence }
}

/**
 * Approve a draft and convert it to an official record.
 */
export async function approveDraft(draftId: string): Promise<boolean> {
  const res = await fetch(`/api/ingestion/drafts?id=${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validationStatus: 'VALIDATED' }),
  })
  return res.ok
}

/**
 * Reject a draft.
 */
export async function rejectDraft(draftId: string, reason: string): Promise<boolean> {
  const res = await fetch(`/api/ingestion/drafts?id=${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validationStatus: 'REJECTED', rejectionReason: reason }),
  })
  return res.ok
}
