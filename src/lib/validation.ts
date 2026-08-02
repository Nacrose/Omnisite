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
  children: z.string().optional(), // serialized JSON
  baseline: z.string().optional(), // serialized JSON
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
  children: z.string().optional(),
  baseline: z.string().optional(),
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
  items: z.string().optional(), // serialized JSON
  has_grn: z.boolean().default(false),
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
  type: z.string().optional(),
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
