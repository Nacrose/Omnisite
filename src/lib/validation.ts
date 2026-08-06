import { z } from 'zod'

// ─── Validation schemas for each API route ──────────────────────────────────
// These schemas validate the request body BEFORE it reaches Supabase.
// If validation fails, the API returns 400 with a clear error message.

// BOQ Items
export const boqItemSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  code: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['Priced', 'Provisional Sum', 'Daywork', 'Heading']).default('Priced'),
  qty: z.number().min(0).default(0),
  uom: z.string().optional(),
  rate: z.number().min(0).default(0),
  has_ra: z.boolean().default(false),
  level: z.number().int().min(0).default(0),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  // No DB column — sent by client but silently dropped by PostgREST. Kept for forward compat.
  children: z.string().optional(), // serialized JSON
  // No DB column — sent by client but silently dropped by PostgREST. Kept for forward compat.
  baseline: z.string().optional(), // serialized JSON
  // location_id column added in migration 12 — nullable FK to
  // project_locations(id). Without this entry Zod would strip the field on
  // POST and the BOQ item's work-face link would silently disappear.
  location_id: z.string().nullable().optional(),
})

// Tasks
export const taskSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['Work', 'Milestone', 'Hammock', 'Summary']).default('Work'),
  start_week: z.number().int().min(0).default(0),
  duration: z.number().int().min(0).default(1),
  progress: z.number().int().min(0).max(100).default(0),
  baseline_start: z.number().int().min(0).default(0),
  baseline_finish: z.number().int().min(0).default(0),
  critical: z.boolean().default(false),
  constraints: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  // No DB column — sent by client but silently dropped by PostgREST. Kept for forward compat.
  children: z.string().optional(),
  // No DB column — sent by client but silently dropped by PostgREST. Kept for forward compat.
  baseline: z.string().optional(),
  // Serialized JSON of TaskDependency[] (predecessorId + linkType + lag).
  // Same pattern as `children` / `baseline` — the client JSON.stringifies
  // before POSTing. Without this, the Zod validation stripped the field
  // on POST, so dependencies silently disappeared in Supabase mode and
  // CPM re-calculation produced a flat (no-predecessor) network after
  // every reload.
  dependencies: z.string().optional(),
  // location_id column added in migration 12 — nullable FK to
  // project_locations(id). Without this entry Zod would strip the field
  // on POST and the task's work-face link would silently disappear.
  location_id: z.string().nullable().optional(),
  // resources JSONB column added in migration 18 — serialized JSON of the
  // Task.resources string[] (resource codes assigned to the task). Without
  // this entry Zod would strip the field on POST, so resource assignments
  // silently disappeared in Supabase mode and resource leveling's peak
  // load calc would always report zero (audit H4).
  resources: z.string().optional(),
})

// Workers
export const workerSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  trade: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['on-site', 'off-site', 'break']).default('off-site'),
  clock_in: z.string().nullable().optional(),
  clock_out: z.string().nullable().optional(),
  geo_fence: z.boolean().default(true),
  today_hours: z.number().min(0).default(0),
  allocated: z.string().optional(), // serialized JSON
  // Wage fields (migration 18) — used by the payroll calculator
  // (computeDailyPayroll in time-attendance/payroll-calc.ts) to derive
  // regular vs OT pay. Without these schema entries Zod stripped them on
  // POST, so wage edits silently vanished in Supabase mode and the
  // financials labour-cost roll-up went back to its default rate of 0.
  wage_rate: z.number().min(0).optional(),
  ot_multiplier: z.number().min(0).default(1.5),
  standard_hours: z.number().min(0).default(8),
})

// Equipment
export const equipmentSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.string().optional(),
  status: z.enum(['active', 'breakdown', 'idle']).default('idle'),
  owned: z.boolean().default(false),
  operator: z.string().optional(),
  license_expiry: z.string().optional(),
  charge_rate: z.number().min(0).default(0),
  fuel_today: z.number().min(0).default(0),
  hours_today: z.number().min(0).default(0),
  burn_rate: z.number().min(0).default(0),
  burn_norm: z.number().min(0).default(0),
  rental: z.string().nullable().optional(), // serialized JSON
  docs: z.string().optional(), // serialized JSON
})

// CBS Nodes
export const cbsNodeSchema = z.object({
  code: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  budget: z.number().min(0).default(0),
  committed: z.number().min(0).default(0),
  actual: z.number().min(0).default(0),
  forecast: z.number().min(0).default(0),
  margin_pct: z.number().default(0),
  level: z.number().int().min(0).default(0),
  parent_code: z.string().nullable().optional(),
  // No DB column — sent by client but silently dropped by PostgREST. Kept for forward compat.
  children: z.string().optional(),
})

// Q&S Items
export const qsItemSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  type: z.enum(['ITR', 'NCR', 'Punch', 'Incident', 'Near-Miss']),
  title: z.string().min(1),
  linked_boq: z.string().optional(),
  status: z.string().default('Open'),
  date: z.string().optional(),
  assignee: z.string().optional(),
  due_date: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  billing_hold: z.boolean().default(false),
  cap: z.string().nullable().optional(), // serialized JSON
  // Date the Corrective Action Plan was submitted to the consultant, and
  // the date the item was closed. These existed on the client type but
  // had no DB columns / schema entries, so any Q&S item with these set
  // would silently lose them on POST in Supabase mode (Zod stripped the
  // unknown fields, and the DB rejected them as missing columns).
  cap_submitted_date: z.string().nullable().optional(),
  closed_date: z.string().nullable().optional(),
  // location_id column added in migration 12 — nullable FK to
  // project_locations(id). Without this entry Zod would strip the field
  // on POST and the Q&S item's work-face link would silently disappear.
  location_id: z.string().nullable().optional(),
})

// Chat Messages
export const chatMessageSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  sender_id: z.string().min(1),
  sender_name: z.string().min(1),
  sender_initials: z.string().optional(),
  sender_color: z.string().optional(),
  channel_id: z.string().default('general'),
  content: z.string().min(1),
  message_type: z.enum(['text', 'image', 'file', 'voice']).default('text'),
  media_url: z.string().optional(),
  reply_to: z.string().uuid().nullable().optional(),
})

// Subcontractors
export const subcontractorSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  scope: z.string().optional(),
  agreement_value: z.number().min(0).default(0),
  advance_paid: z.number().min(0).default(0),
  advance_pct: z.number().default(0),
  retention_pct: z.number().default(0),
  rework_cost: z.number().min(0).default(0),
  status: z.string().default('Active'),
  pan: z.string().optional(),
  gst: z.string().optional(),
  insurance_expiry: z.string().optional(),
  labour_license_expiry: z.string().optional(),
  is_tunneling: z.boolean().default(false),
  items: z.string().optional(), // serialized JSON
  material_issues: z.string().optional(), // serialized JSON
  material_returns: z.string().optional(), // serialized JSON
  consumables: z.string().optional(), // serialized JSON
  custom_deductibles: z.string().optional(), // serialized JSON
  assigned_tasks: z.string().optional(), // serialized JSON
  ncr_count: z.number().int().min(0).default(0),
  incidents: z.number().int().min(0).default(0),
})

// Drawings
export const drawingSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  number: z.string().min(1),
  title: z.string().min(1),
  revision: z.string().optional(),
  date: z.string().optional(),
  status: z.string().default('Open'),
  size: z.string().optional(),
  discipline: z.string().optional(),
  links: z.string().optional(), // serialized JSON
  history: z.string().optional(), // serialized JSON
  file_url: z.string().optional(),
  file_type: z.string().optional(),
  source_file_url: z.string().optional(),
  file_size: z.number().int().nonnegative().optional(),
})

// Drawing annotations (markups on a PDF page — separate from the original file)
export const drawingAnnotationSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  drawing_id: z.string().min(1),
  page_number: z.number().int().min(1).default(1),
  author_id: z.string().min(1),
  author_name: z.string().min(1),
  type: z.enum(['freehand', 'rectangle', 'text', 'stamp', 'arrow', 'circle']),
  color: z.string().default('#ef4444'),
  stroke_width: z.number().min(0).default(2),
  // fabric_data is a JSON object — the full Fabric.js serialized object.
  // The API stores it as JSONB; the client sends it as a JSON object (not a string).
  fabric_data: z.any(),
  text_content: z.string().nullable().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
})

// DSR (Daily Site Report) entries
export const dsrEntrySchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  task: z.string().min(1),
  source: z.string().optional(),
  chainage: z.string().optional(),
  planned: z.number().min(0).default(0),
  actual: z.number().min(0).default(0),
  uom: z.string().optional(),
  status: z.string().default('Open'),
  has_rfi: z.boolean().default(false),
  has_photos: z.boolean().default(false),
  remarks: z.string().optional(),
  date: z.string().optional(),
  // location_id column added in migration 12 — nullable FK to
  // project_locations(id). Without this entry Zod would strip the field
  // on POST and the DSR entry's work-face link would silently disappear.
  location_id: z.string().nullable().optional(),
})

// Requisitions
export const requisitionSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  item: z.string().min(1),
  uom: z.string().optional(),
  qty: z.number().min(0).default(0),
  status: z.string().default('Open'),
  source: z.string().optional(),
  vendors: z.string().optional(), // serialized JSON
  override_reason: z.string().optional(),
})

// Purchase orders
export const purchaseOrderSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  vendor: z.string().min(1),
  date: z.string().optional(),
  value: z.number().min(0).default(0),
  status: z.string().default('Open'),
  // `items` is an INTEGER count on the purchase_orders table, not a JSONB
  // blob — the previous `z.string().optional()` rejected the client's
  // numeric `items: group.itemCount` and Zod stripped the field on POST,
  // so item counts silently zeroed out in Supabase mode.
  items: z.number().int().default(0),
  has_grn: z.boolean().default(false),
  // Unit rate at PO creation and ordered quantity — both NUMERIC columns on
  // purchase_orders (migration 00000000000000). Without these schema entries
  // Zod stripped them on POST, so the 3-way match lost its locked-rate
  // reference and quantity reconciliation broke in Supabase mode.
  rate: z.number().min(0).optional(),
  po_qty: z.number().min(0).optional(),
})

// GRN (Goods Received Note) — 3-way match (PO vs GRN vs Invoice)
export const grnSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  po_id: z.string().min(1),
  vendor: z.string().min(1),
  po_qty: z.number().min(0).default(0),
  grn_qty: z.number().min(0).default(0),
  invoice_qty: z.number().min(0).default(0),
  rate: z.number().min(0).default(0),
  // Unit rate as per the PO (the agreed rate) — added by migration
  // 00000000000014_add_po_rate_to_grns.sql as `po_rate NUMERIC DEFAULT 0`.
  // Without this schema entry Zod stripped `po_rate` on POST, so the 3-way
  // match's locked-amount calc (rate variance = invoice.rate − po_rate) lost
  // its reference and always reported zero variance in Supabase mode.
  po_rate: z.number().min(0).optional(),
  pay_status: z.enum(['Cleared', 'Hold', 'Partial Hold', 'Awaiting GRN']).default('Awaiting GRN'),
  material_code: z.string().optional(),
  date: z.string().optional(),
})

// Stock items — live inventory
export const stockItemSchema = z.object({
  code: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  on_hand: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  avg_cost: z.number().min(0).default(0),
  warehouse: z.string().optional(),
})

// Letters (correspondence)
export const letterSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  number: z.string().min(1),
  date: z.string().optional(),
  type: z.string().min(1),
  from_party: z.string().optional(),
  to_party: z.string().optional(),
  subject: z.string().optional(),
  reply_by: z.string().optional(),
  reply_to: z.string().nullable().optional(),
  has_variation: z.boolean().default(false),
  body: z.string().optional(),
})

// Projects — top-level table (no project_id filter)
export const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  location: z.string().optional(),
  value: z.number().min(0).default(0),
  progress: z.number().int().min(0).max(100).default(0),
  status: z.string().default('Active'),
})

// User-project assignments (membership / role linkage)
export const userProjectSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  role: z.string().default('FOREMAN'),
})

// ─── Unified Vendor master (supersedes `subcontractors`) ──────────────────────
// Mirrors the `vendors` table in supabase/migrations/00000000000010. The
// JSONB SC-operational arrays (work_items, material_issues, material_returns,
// consumables, custom_deductibles, assigned_tasks, docs, materials_supplied)
// are accepted as pre-serialized JSON strings — the client is responsible
// for JSON.stringify() before POSTing (same pattern the existing routes
// use for cbs_nodes.children, grns.items, etc.).
export const vendorSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  category: z.enum(['supplier', 'subcontractor', 'consultant', 'labour']).default('supplier'),
  name: z.string().min(1),
  trade_name: z.string().optional(),
  status: z.enum(['active', 'closed', 'blacklisted']).default('active'),
  rating: z.string().default('A'),

  // Legal & compliance
  pan: z.string().optional(),
  gst: z.string().optional(),
  vat_no: z.string().optional(),

  // Contact
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),

  // Banking
  bank_account_name: z.string().optional(),
  bank_account_no: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_ifsc: z.string().optional(),

  // Payment terms
  credit_days: z.number().int().min(0).default(30),
  advance_pct: z.number().default(0),
  retention_pct: z.number().default(0),
  tds_section: z.string().optional(),
  tds_rate: z.number().default(0),

  // Compliance docs + supply catalog + SC operational data (JSONB arrays)
  docs: z.string().optional(),
  materials_supplied: z.string().optional(),
  work_items: z.string().optional(),
  scope: z.string().optional(),
  agreement_value: z.number().min(0).default(0),
  advance_paid: z.number().min(0).default(0),
  rework_cost: z.number().min(0).default(0),
  // Cumulative advance recovered across prior bills — persisted so the
  // running-bill tab's recovery tally survives a reload in Supabase mode.
  // Column added in migration 18.
  advance_recovered: z.number().default(0),
  is_tunneling: z.boolean().default(false),
  material_issues: z.string().optional(),
  material_returns: z.string().optional(),
  consumables: z.string().optional(),
  custom_deductibles: z.string().optional(),
  assigned_tasks: z.string().optional(),
  ncr_count: z.number().int().min(0).default(0),
  incidents: z.number().int().min(0).default(0),
})

// ─── Project Locations ──────────────────────────────────────────────────────
// Physical work-face / asset locations scoped to a project (bridge piers,
// road chainage stretches, site campus areas, batch plant, etc.). Mirrors
// the `project_locations` table in migration 00000000000010.
export const projectLocationSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  group_name: z.string().default('General'),
  description: z.string().optional(),
  status: z.enum(['active', 'closed']).default('active'),
  assigned_vendor_id: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
})

// RFIs (Requests For Information) — moved from localStorage to DB in
// migration 28. Mirrors the Rfi TypeScript interface in
// src/components/modules/daily-ops/rfi-store.ts. The `reply`, `reply_by`,
// `replied_date`, `linked_dsr`, `cost_impact`, `schedule_impact`, and
// `location_id` fields are nullable so an Open RFI doesn't need to
// fabricate values for fields it doesn't have yet.
export const rfiSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  number: z.string().min(1),
  date: z.string().min(1),
  subject: z.string().min(1),
  question: z.string().min(1),
  background: z.string().default(''),
  impact: z.string().default(''),
  status: z.enum(['Open', 'Replied', 'Closed']).default('Open'),
  reply_by: z.string().default(''),
  reply: z.string().nullable().optional(),
  replied_date: z.string().nullable().optional(),
  linked_dsr: z.string().nullable().optional(),
  cost_impact: z.string().nullable().optional(),
  schedule_impact: z.string().nullable().optional(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  location_id: z.string().nullable().optional(),
})

// Material Issue Notes (MINs) — moved from localStorage to DB in migration 29.
// Mirrors the MinNote TypeScript interface in
// src/components/modules/procurement/types.ts:74. Stock deduction stays an
// app-level concern (material-reconciliation.ts); this table is the source of
// truth for the MIN register only.
export const materialIssueNoteSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  date: z.string().min(1),
  task: z.string().min(1),
  items: z.string().min(1),
  issued: z.string().min(1),
  status: z.enum(['Issued', 'N/A']).default('Issued'),
})

// Notifications — backed by migration 30. The cron route inserts rows
// (service-role, no API surface for user-side inserts). Users can only
// update read_at and delete (PM-only cleanup).
export const notificationSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  user_id: z.string().uuid().nullable().optional(),
  type: z.enum(['rfi_overdue', 'ncr_hold', 'po_approval', 'dsr_review', 'variation_threshold']),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  module: z.string().nullable().optional(),
  context: z.any().optional(),
  read_at: z.string().nullable().optional(),
  dispatch_status: z.string().nullable().optional(),
})

// Per-day attendance records (migration 31). Each row is one worker's
// attendance on one date. The (worker_id, date) pair is unique.
// The id is generated by the app as `WA-<workerId>-<YYYY-MM-DD>` so
// re-inserts are idempotent.
export const workerAttendanceSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  worker_id: z.string().min(1),
  date: z.string().min(1), // YYYY-MM-DD
  hours: z.number().min(0).max(24).default(0),
  ot_hours: z.number().min(0).default(0),
  wage_override: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  logged_by: z.string().uuid().nullable().optional(),
})

// ─── Helper: validate and return error response ─────────────────────────────

import { NextResponse } from 'next/server'

export type ValidationResult<T> = { data: T; error: null } | { data: null; error: NextResponse }

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      data: null,
      error: NextResponse.json(
        {
          error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
        },
        { status: 400 }
      ),
    }
  }
  return { data: result.data, error: null }
}
