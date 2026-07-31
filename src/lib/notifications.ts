/**
 * OmniSite — server-side notification dispatch.
 *
 * `sendNotification()` is intended to be called from API route handlers
 * (server-side) when a business event triggers an alert — e.g. an RFI crossing
 * its due date, an NCR placing a billing hold, a PO awaiting approval, etc.
 *
 * Behaviour:
 *  - ALWAYS logs to console (visible in `bun run dev` output and Vercel logs).
 *  - When EMAIL_PROVIDER env var is set → would send an email (stub for now;
 *    wire up Resend / SendGrid / Postmark later).
 *  - When SMS_PROVIDER env var is set → would send an SMS (stub for now;
 *    wire up Twilio / SparrowSMS-Nepal later).
 *
 * Because the function reads `process.env` directly, it works correctly on
 * the server. On the client, the env vars are undefined and only the console
 * log fires — which is acceptable for development/demo mode.
 */

export type NotificationType =
  | 'rfi_overdue'
  | 'ncr_hold'
  | 'po_approval'
  | 'dsr_review'
  | 'variation_threshold'

export interface NotificationMeta {
  type: NotificationType
  message: string
  recipient: string                  // user id, email, or role tag
  subject?: string
  /** Arbitrary payload — record id, amount, etc. */
  context?: Record<string, unknown>
}

const TYPE_LABELS: Record<NotificationType, string> = {
  rfi_overdue: 'RFI Overdue',
  ncr_hold: 'NCR Billing Hold',
  po_approval: 'PO Approval Required',
  dsr_review: 'DSR Review Needed',
  variation_threshold: 'Variation Threshold Breached',
}

const TYPE_SEVERITY: Record<NotificationType, 'info' | 'warning' | 'critical'> = {
  rfi_overdue: 'critical',
  ncr_hold: 'critical',
  po_approval: 'warning',
  dsr_review: 'warning',
  variation_threshold: 'warning',
}

/**
 * Send a notification through every configured channel.
 *
 * @returns a summary of which channels dispatched successfully — useful for
 *          audit log / debugging.
 */
export async function sendNotification(
  type: NotificationType,
  message: string,
  recipient: string,
  subject?: string,
  context?: Record<string, unknown>,
): Promise<{ console: boolean; email: boolean; sms: boolean }> {
  const meta: NotificationMeta = { type, message, recipient, subject, context }
  const severity = TYPE_SEVERITY[type]
  const label = TYPE_LABELS[type]

  const result = { console: false, email: false, sms: false }

  // ─── 1. Always log to console ────────────────────────────────────────────
  // Tagged prefix makes these easy to grep in `dev.log`.
  console.log(
    `[NOTIFY:${severity.toUpperCase()}] ${label} → ${recipient}`,
    { message, subject: subject ?? label, context: context ?? {} },
  )
  result.console = true

  // ─── 2. Email (stub) ──────────────────────────────────────────────────────
  // Wire up a real provider later — e.g. Resend:
  //   if (process.env.EMAIL_PROVIDER === 'resend') {
  //     await resend.emails.send({ from, to: recipient, subject, html })
  //   }
  const emailProvider = process.env.EMAIL_PROVIDER
  if (emailProvider) {
    try {
      // STUB: replace with real provider call.
      console.log(`[NOTIFY:EMAIL→${emailProvider}] to=${recipient} subject="${subject ?? label}"`)
      result.email = true
    } catch (e) {
      console.error('[NOTIFY:EMAIL] dispatch failed:', e)
    }
  }

  // ─── 3. SMS (stub) ─────────────────────────────────────────────────────────
  // Wire up Twilio / SparrowSMS-Nepal later:
  //   if (process.env.SMS_PROVIDER === 'twilio') {
  //     await twilio.messages.create({ to: recipient, from, body: message })
  //   }
  const smsProvider = process.env.SMS_PROVIDER
  if (smsProvider) {
    try {
      // STUB: replace with real provider call.
      console.log(`[NOTIFY:SMS→${smsProvider}] to=${recipient} body="${message}"`)
      result.sms = true
    } catch (e) {
      console.error('[NOTIFY:SMS] dispatch failed:', e)
    }
  }

  return result
}

/**
 * Convenience wrappers for the common notification types.
 * Keeps call sites readable: `notifyRfiOverdue(recipient, rfiId, daysLate)`.
 */
export const notifyRfiOverdue = (recipient: string, rfiId: string, daysLate: number) =>
  sendNotification(
    'rfi_overdue',
    `RFI ${rfiId} is ${daysLate} day(s) overdue — consultant reply still pending.`,
    recipient,
    `Overdue: ${rfiId}`,
    { rfiId, daysLate },
  )

export const notifyNcrHold = (recipient: string, ncrId: string, boqItem: string) =>
  sendNotification(
    'ncr_hold',
    `NCR ${ncrId} placed a billing hold on BOQ ${boqItem} — Max Billable Qty set to 0 until closed.`,
    recipient,
    `Billing hold: ${ncrId}`,
    { ncrId, boqItem },
  )

export const notifyPoApproval = (recipient: string, poId: string, amount: string) =>
  sendNotification(
    'po_approval',
    `Purchase Order ${poId} (NPR ${amount}) is awaiting your approval.`,
    recipient,
    `Approval required: ${poId}`,
    { poId, amount },
  )

export const notifyDsrReview = (recipient: string, dsrId: string, submittedBy: string) =>
  sendNotification(
    'dsr_review',
    `DSR ${dsrId} submitted by ${submittedBy} is awaiting your review.`,
    recipient,
    `Review needed: ${dsrId}`,
    { dsrId, submittedBy },
  )

export const notifyVariationThreshold = (recipient: string, boqItem: string, pct: number) =>
  sendNotification(
    'variation_threshold',
    `Variation on BOQ ${boqItem} crossed ${pct}% threshold — PM approval required.`,
    recipient,
    `Variation > ${pct}%: ${boqItem}`,
    { boqItem, pct },
  )
