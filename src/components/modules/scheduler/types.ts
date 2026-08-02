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
  // No DB column — seed-only fields, not persisted in Supabase mode
  boqAllocated?: number
  // No DB column — seed-only fields, not persisted in Supabase mode
  boqTotal?: number
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
