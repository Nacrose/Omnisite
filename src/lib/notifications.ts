/**
 * OmniSite — server-side notification dispatch.
 *
 * `sendNotification()` is called from API route handlers (server-side) when
 * a business event triggers an alert.
 *
 * Delivery channels:
 *  - Console: ALWAYS logs (visible in Vercel logs / dev output).
 *  - Email: When RESEND_API_KEY env var is set, sends via Resend.
 *  - SMS: When TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN env vars are set,
 *    sends via Twilio. For Nepal, SparrowSMS can be added similarly.
 *
 * If no provider env vars are set, only the console log fires — which is
 * the current state (no provider configured yet). The interface is real;
 * the delivery is console-only until a provider key is added to Vercel.
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
  recipient: string
  subject?: string
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

  // 1. Console — always
  console.log(
    `[NOTIFY:${severity.toUpperCase()}] ${label} → ${recipient}`,
    { message, subject: subject ?? label, context: context ?? {} },
  )
  result.console = true

  // 2. Email via Resend (when RESEND_API_KEY is configured)
  const resendKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM || 'noreply@omnisite.app'
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: recipient,
          subject: subject ?? label,
          text: `${label}: ${message}\n\nContext: ${JSON.stringify(context ?? {})}`,
        }),
      })
      if (res.ok) {
        result.email = true
      } else {
        console.error('[NOTIFY:EMAIL] Resend API error:', res.status, await res.text())
      }
    } catch (e) {
      console.error('[NOTIFY:EMAIL] dispatch failed:', e)
    }
  }

  // 3. SMS via Twilio (when TWILIO_ACCOUNT_SID is configured)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioFrom,
            To: recipient,
            Body: `${label}: ${message}`,
          }),
        },
      )
      if (res.ok) {
        result.sms = true
      } else {
        console.error('[NOTIFY:SMS] Twilio API error:', res.status, await res.text())
      }
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
