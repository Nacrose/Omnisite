import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'
import { sendNotification } from '@/lib/notifications'

/**
 * Cron-driven notifications scanner.
 *
 * URL: POST /api/cron/notifications-scan
 * Auth: CRON_SECRET header (set in env vars, configured in Vercel cron).
 *
 * For each project, scans for:
 *   1. Overdue RFIs (status = 'Open' AND reply_by < today)
 *      → inserts a 'rfi_overdue' notification addressed to the project's PMs
 *   2. NCRs with active billing holds (status = 'Active' on billing_holds)
 *      → inserts a 'ncr_hold' notification addressed to the PMs
 *   3. POs awaiting approval > 24h
 *      → inserts a 'po_approval' notification addressed to the PMs
 *
 * Each notification is dedup'd by checking if an unread notification of the
 * same type + context already exists for the same user — avoids spamming
 * the PM with one notification per cron run.
 *
 * If RESEND_API_KEY / TWILIO_ACCOUNT_SID env vars are set, the email/SMS
 * dispatch fires via sendNotification() (already implemented in
 * src/lib/notifications.ts). Otherwise only the in-app notification row
 * is inserted (visible in the bell).
 *
 * Vercel cron config (vercel.json):
 *   { "path": "/api/cron/notifications-scan", "schedule": "0 9 * * *" }
 *
 * For local testing:
 *   curl -X POST http://localhost:3000/api/cron/notifications-scan \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

export const dynamic = 'force-dynamic'

interface ScanResult {
  scanned: number
  inserted: number
  deduplicated: number
  dispatched: { console: number; email: number; sms: number }
  errors: string[]
}

export async function POST(req: NextRequest) {
  // ─── Auth: CRON_SECRET ───────────────────────────────────────────────────
  // Vercel cron sends the secret as `Authorization: Bearer <CRON_SECRET>`.
  // Without this check, anyone hitting the endpoint could trigger a scan
  // (and potentially spam users with emails).
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized — invalid CRON_SECRET' }, { status: 401 })
    }
  } else {
    // No CRON_SECRET configured — only allow in dev (NODE_ENV !== production).
    // In production, refuse to run without auth (would be an open endpoint).
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET must be configured in production' },
        { status: 500 }
      )
    }
    console.warn(
      '[cron/notifications-scan] CRON_SECRET not configured — allowing request in dev mode only.'
    )
  }

  if (!isServiceClientConfigured()) {
    return NextResponse.json(
      { error: 'Supabase service role not configured — nothing to scan.' },
      { status: 503 }
    )
  }

  const serviceClient = getServiceClient()
  const result: ScanResult = {
    scanned: 0,
    inserted: 0,
    deduplicated: 0,
    dispatched: { console: 0, email: 0, sms: 0 },
    errors: [],
  }

  // ─── 1. Load all projects (so we scan each) ──────────────────────────────
  const { data: projects, error: projectsError } = await serviceClient
    .from('projects')
    .select('id, name')
    .order('name')

  if (projectsError || !projects) {
    return NextResponse.json(
      { error: 'Failed to load projects', detail: projectsError?.message },
      { status: 500 }
    )
  }

  // ─── 2. For each project, find the PM(s) to notify ──────────────────────
  // Notifications go to the project's PMs by default. A future iteration
  // could let users opt into per-type notifications.
  const { data: projectPMs, error: pmsError } = await serviceClient
    .from('user_projects')
    .select('user_id, project_id, role')
    .eq('role', 'PM')

  if (pmsError) {
    result.errors.push(`Failed to load PMs: ${pmsError.message}`)
  }

  // Build project_id → PM user_ids lookup
  const pmsByProject = new Map<string, string[]>()
  for (const row of projectPMs || []) {
    const arr = pmsByProject.get(row.project_id) || []
    arr.push(row.user_id)
    pmsByProject.set(row.project_id, arr)
  }

  // ─── 3. Look up PM emails (for the email dispatch) ──────────────────────
  // We need to call auth.admin.listUsers() and match by id. This is a
  // single call (cached per cron run).
  const pmEmails = new Map<string, string>()
  if (projectPMs && projectPMs.length > 0) {
    const { data: usersList, error: usersError } = await serviceClient.auth.admin.listUsers()
    if (usersError) {
      result.errors.push(`Failed to list users for email lookup: ${usersError.message}`)
    } else {
      for (const u of usersList?.users || []) {
        if (u.email) pmEmails.set(u.id, u.email)
      }
    }
  }

  // ─── 4. Scan: overdue RFIs ───────────────────────────────────────────────
  // RFIs with status='Open' AND reply_by is set AND reply_by < today.
  // reply_by is stored as a TEXT field (e.g. '26 Jul 2026') so we parse
  // it client-side. The strict SQL filter would be:
  //   status = 'Open' AND reply_by IS NOT NULL AND reply_by != ''
  // Then we parse + compare in JS. A future migration could store
  // reply_by as a DATE column for direct SQL comparison.
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  for (const project of projects) {
    result.scanned++
    const pms = pmsByProject.get(project.id) || []
    if (pms.length === 0) continue

    // ─── 4a. Overdue RFIs ──────────────────────────────────────────────────
    const { data: openRfis, error: rfisError } = await serviceClient
      .from('rfis')
      .select('id, number, subject, reply_by')
      .eq('project_id', project.id)
      .eq('status', 'Open')
      .not('reply_by', 'is', null)
      .neq('reply_by', '')

    if (rfisError) {
      result.errors.push(`rfis scan failed for ${project.id}: ${rfisError.message}`)
    } else if (openRfis) {
      for (const rfi of openRfis) {
        // Parse '26 Jul 2026' — DD MMM YYYY format
        const replyDate = new Date(rfi.reply_by + ' UTC')
        if (Number.isNaN(replyDate.getTime())) continue
        if (replyDate >= today) continue // not overdue yet

        const daysLate = Math.floor((today.getTime() - replyDate.getTime()) / (24 * 60 * 60 * 1000))

        for (const pmId of pms) {
          // Dedup: skip if an unread 'rfi_overdue' notification already
          // exists for this user + RFI id (in context).
          const { data: existing } = await serviceClient
            .from('notifications')
            .select('id')
            .eq('user_id', pmId)
            .eq('project_id', project.id)
            .eq('type', 'rfi_overdue')
            .is('read_at', null)
            .contains('context', { rfiId: rfi.id })
            .limit(1)

          if (existing && existing.length > 0) {
            result.deduplicated++
            continue
          }

          const { data: inserted, error: insertError } = await serviceClient
            .from('notifications')
            .insert({
              user_id: pmId,
              project_id: project.id,
              type: 'rfi_overdue',
              title: `Overdue: ${rfi.number}`,
              message: `RFI ${rfi.number} (${rfi.subject}) is ${daysLate} day(s) overdue — consultant reply pending.`,
              severity: 'critical',
              module: 'daily-ops',
              context: { rfiId: rfi.id, rfiNumber: rfi.number, daysLate },
              dispatch_status: 'pending',
            })
            .select('id')
            .single()

          if (insertError) {
            result.errors.push(`insert rfi_overdue failed: ${insertError.message}`)
            continue
          }
          result.inserted++

          // Dispatch via email/SMS if configured
          const email = pmEmails.get(pmId)
          if (email) {
            const dispatched = await sendNotification(
              'rfi_overdue',
              `RFI ${rfi.number} (${rfi.subject}) is ${daysLate} day(s) overdue.`,
              email,
              `Overdue: ${rfi.number}`,
              { rfiId: rfi.id, daysLate }
            )
            if (dispatched.console) result.dispatched.console++
            if (dispatched.email) result.dispatched.email++
            if (dispatched.sms) result.dispatched.sms++

            // Update dispatch_status
            const status = dispatched.email || dispatched.sms ? 'sent' : 'skipped'
            await serviceClient
              .from('notifications')
              .update({ dispatch_status: status })
              .eq('id', inserted?.id)
          }
        }
      }
    }

    // ─── 4b. Active billing holds (NCR-hold) ───────────────────────────────
    // Skipped for now — the billing_holds table is sparse and many holds
    // have hold_amount=0 (informational). A future iteration can scan
    // billing_holds WHERE status='ACTIVE' AND hold_amount > 0 AND
    // created_at < now() - interval '24 hours' to find ones that have
    // been ignored for too long.

    // ─── 4c. POs awaiting approval ──────────────────────────────────────────
    // No 'awaiting approval' field on purchase_orders in the current
    // schema — the 3-way match is computed client-side. Skipping for now;
    // a future migration could add an 'approval_status' column.
  }

  // ─── 5. Return the summary ───────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    timestamp: todayStr,
    ...result,
  })
}

// Also allow GET for easy testing in the browser (dev only — same auth).
export async function GET(req: NextRequest) {
  return POST(req)
}
