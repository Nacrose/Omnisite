// ─── Types & constants for the Scheduler module ─────────────────────────────

/**
 * A dependency link between two tasks.
 * - FS (Finish-to-Start): predecessor must finish before successor starts
 * - SS (Start-to-Start):  predecessor must start before successor starts
 * - FF (Finish-to-Finish): predecessor must finish before successor finishes
 * - SF (Start-to-Finish):  predecessor must start before successor finishes
 *
 * Lag is in weeks (can be negative for lead/acceleration).
 */
export type LinkType = 'FS' | 'SS' | 'FF' | 'SF'

export interface TaskDependency {
  /** Successor task id (the task that depends on the predecessor). */
  taskId: string
  /** Predecessor task id (the task that must finish/start first). */
  predecessorId: string
  linkType: LinkType
  lagWeeks: number
}

export interface Task {
  id: string
  name: string
  type: 'Work' | 'Milestone' | 'Hammock' | 'Summary'
  start: number // week offset
  duration: number
  progress: number
  baseline: [number, number]
  resources: string[]
  critical?: boolean
  constraints?: string
  // Not in Zod schema (validation.ts taskSchema) — Zod strips unknown keys
  // before POST, so these fields never reach the DB and no `boq_allocated` /
  // `boq_total` columns exist on the tasks table. They are seed-only fields
  // used by the BOQ/RA tab in the TaskInspector (currently unpopulated in
  // the seed) and are NOT persisted in Supabase mode. Adding them to the
  // schema without a backing column would cause PostgREST to reject the
  // POST; leaving them off the type entirely would lose the seed data.
  boqAllocated?: number
  // Not in Zod schema — stripped before POST, seed-only field. See above.
  boqTotal?: number
  /** BOQ item code this task is linked to (e.g. "1.1.1"). Not in Zod schema —
   *  stored locally only. When set, the BOQ tab shows the linked item's
   *  description, qty, rate, and amount. */
  boqItemId?: string
  children?: Task[]
  /**
   * Dependency links — this task depends on these predecessors.
   * Fed into calculateCpm() to compute the real critical path.
   * Empty array means no explicit dependencies (ASAP scheduling).
   */
  dependencies?: TaskDependency[]
  /**
   * Optional FK to project_locations.id — the physical work-face / asset
   * location this task is being executed at (e.g. "Pier 3"). Persisted to
   * the `location_id` column (added in migration 12) and round-tripped via
   * the `locationId: 'location_id'` fieldMap entry in scheduler/index.tsx.
   */
  locationId?: string
}

// Re-export the seed data array so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/scheduler'.
export { TASKS } from '@/data/seed/scheduler'

export const TOTAL_WEEKS = 52
export const WEEK_WIDTH = 26

/**
 * Compute the effective project horizon (in weeks) from a task tree.
 * Uses the latest (start + duration) across all tasks, with a minimum
 * of TOTAL_WEEKS (52). This allows projects longer than one year
 * without truncating the Gantt canvas, drag clamps, or input maxes.
 *
 * Previously TOTAL_WEEKS=52 was hardcoded everywhere — the Gantt canvas,
 * drag clamps, inspector inputs, modal inputs, and leveling all capped
 * at 52 weeks. Now the scheduler computes this dynamically and passes
 * it to all consumers. The types.ts constant remains as the minimum
 * floor.
 */
export function computeProjectWeeks(tasks: Task[]): number {
  let max = TOTAL_WEEKS
  const walk = (items: Task[]) => {
    for (const t of items) {
      const finish = t.start + t.duration
      if (finish > max) max = finish
      if (t.children) walk(t.children)
    }
  }
  walk(tasks)
  // Add a 4-week buffer so tasks can be dragged/resized past the
  // current project end without immediately hitting the ceiling.
  return max + 4
}

export function flattenTasks(items: Task[]): { task: Task; depth: number }[] {
  const out: { task: Task; depth: number }[] = []
  const walk = (items: Task[], depth: number) => {
    for (const t of items) {
      out.push({ task: t, depth })
      if (t.children) walk(t.children, depth + 1)
    }
  }
  walk(items, 0)
  return out
}

// Drag state for Gantt bar move / resize interactions
export type DragState =
  | { id: string; startX: number; originalStart: number; mode: 'move' }
  | { id: string; startX: number; originalDuration: number; mode: 'resize' }
  | null
