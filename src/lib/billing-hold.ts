/**
 * Billing hold service — NCR → payment hold automation.
 *
 * When an NCR is opened, automatically creates a billing hold on the
 * associated vendor/subcontractor. The hold prevents payment release
 * until the NCR is closed.
 */

export interface BillingHold {
  id: string
  projectId: string
  ncrId: string | null
  vendorId: string | null
  holdType: 'NCR' | 'GRN' | 'MANUAL'
  holdReason: string
  holdAmount: number
  status: 'ACTIVE' | 'RELEASED' | 'PARTIAL'
  releasedBy: string | null
  releasedAt: string | null
  releaseNotes: string | null
}

/**
 * Create a billing hold when an NCR is opened.
 * Called from the Q&S module's NCR creation flow.
 */
export async function createBillingHoldForNCR(
  projectId: string,
  ncrId: string,
  vendorId: string | null,
  reason: string,
  amount: number = 0
): Promise<BillingHold | null> {
  const res = await fetch('/api/billing-holds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      ncrId,
      vendorId,
      holdType: 'NCR',
      holdReason: reason,
      holdAmount: amount,
      status: 'ACTIVE',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Release a billing hold (when NCR is closed).
 */
export async function releaseBillingHold(
  holdId: string,
  releaseNotes: string
): Promise<boolean> {
  const res = await fetch(`/api/billing-holds?id=${holdId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'RELEASED',
      releaseNotes,
    }),
  })
  return res.ok
}

/**
 * Get active billing holds for a project.
 */
export async function getActiveHolds(projectId: string): Promise<BillingHold[]> {
  const res = await fetch(`/api/billing-holds?projectId=${projectId}&status=ACTIVE`)
  if (!res.ok) return []
  return res.json()
}
