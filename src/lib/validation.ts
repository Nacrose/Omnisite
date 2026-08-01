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

// ─── Helper: validate and return error response ─────────────────────────────

import { NextResponse } from 'next/server'

export type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: NextResponse }

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      data: null,
      error: NextResponse.json(
        {
          error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
        },
        { status: 400 },
      ),
    }
  }
  return { data: result.data, error: null }
}
