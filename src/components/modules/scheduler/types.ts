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
  boqAllocated?: number
  boqTotal?: number
  children?: Task[]
  /**
   * Dependency links — this task depends on these predecessors.
   * Fed into calculateCpm() to compute the real critical path.
   * Empty array means no explicit dependencies (ASAP scheduling).
   */
  dependencies?: TaskDependency[]
}

export const TASKS: Task[] = [
  {
    id: 'T-100',
    name: 'Site Mobilization',
    type: 'Summary',
    start: 0,
    duration: 6,
    progress: 100,
    baseline: [0, 6],
    resources: [],
    children: [
      {
        id: 'T-101',
        name: 'Setup site office & storage',
        type: 'Work',
        start: 0,
        duration: 3,
        progress: 100,
        baseline: [0, 3],
        resources: ['M-1'],
        constraints: 'ASAP',
        dependencies: [{ taskId: 'T-101', predecessorId: 'T-100', linkType: 'SS', lagWeeks: 0 }],
      },
      {
        id: 'T-102',
        name: 'Plant & machinery deployment',
        type: 'Work',
        start: 2,
        duration: 4,
        progress: 100,
        baseline: [2, 6],
        resources: ['E-1', 'E-2'],
        dependencies: [{ taskId: 'T-102', predecessorId: 'T-101', linkType: 'SS', lagWeeks: 2 }],
      },
      {
        id: 'T-103',
        name: 'Mobilization milestone',
        type: 'Milestone',
        start: 6,
        duration: 0,
        progress: 100,
        baseline: [6, 6],
        resources: [],
        constraints: 'FNLT',
        dependencies: [{ taskId: 'T-103', predecessorId: 'T-102', linkType: 'FS', lagWeeks: 0 }],
      },
    ],
  },
  {
    id: 'T-200',
    name: 'Foundation Works',
    type: 'Summary',
    start: 5,
    duration: 14,
    progress: 72,
    baseline: [4, 18],
    resources: [],
    children: [
      {
        id: 'T-201',
        name: 'Excavation ch. 0+000 to 1+200',
        type: 'Work',
        start: 5,
        duration: 5,
        progress: 100,
        baseline: [4, 9],
        resources: ['E-3', 'L-1'],
        boqAllocated: 1240,
        boqTotal: 1240,
        constraints: 'SNET',
        dependencies: [{ taskId: 'T-201', predecessorId: 'T-103', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-202',
        name: 'Stone soling layer',
        type: 'Work',
        start: 9,
        duration: 3,
        progress: 88,
        baseline: [9, 12],
        resources: ['L-1', 'L-2'],
        boqAllocated: 285,
        boqTotal: 320,
        dependencies: [{ taskId: 'T-202', predecessorId: 'T-201', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-203',
        name: 'PCC M15 pouring',
        type: 'Work',
        start: 11,
        duration: 4,
        progress: 62,
        baseline: [12, 16],
        resources: ['L-1', 'E-4'],
        boqAllocated: 88,
        boqTotal: 88,
        critical: true,
        dependencies: [{ taskId: 'T-203', predecessorId: 'T-202', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-204',
        name: 'PCC curing period',
        type: 'Work',
        start: 14,
        duration: 5,
        progress: 25,
        baseline: [15, 20],
        resources: [],
        constraints: 'FS+5',
        dependencies: [{ taskId: 'T-204', predecessorId: 'T-203', linkType: 'FS', lagWeeks: 0 }],
      },
    ],
  },
  {
    id: 'T-300',
    name: 'Box Culvert Construction',
    type: 'Summary',
    start: 14,
    duration: 20,
    progress: 35,
    baseline: [13, 33],
    resources: [],
    children: [
      {
        id: 'T-301',
        name: 'Hammock — Tunneling uncertain',
        type: 'Hammock',
        start: 14,
        duration: 18,
        progress: 35,
        baseline: [13, 31],
        resources: ['L-3'],
        constraints: 'Must Finish On: Wk 32',
        critical: true,
        dependencies: [{ taskId: 'T-301', predecessorId: 'T-103', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-302',
        name: 'Base slab concrete',
        type: 'Work',
        start: 14,
        duration: 5,
        progress: 70,
        baseline: [14, 19],
        resources: ['L-1', 'E-4'],
        dependencies: [{ taskId: 'T-302', predecessorId: 'T-301', linkType: 'SS', lagWeeks: 0 }],
      },
      {
        id: 'T-303',
        name: 'Wall & slab rebar',
        type: 'Work',
        start: 18,
        duration: 8,
        progress: 12,
        baseline: [18, 26],
        resources: ['L-1', 'L-2'],
        critical: true,
        dependencies: [{ taskId: 'T-303', predecessorId: 'T-302', linkType: 'FS', lagWeeks: 0 }],
      },
    ],
  },
  {
    id: 'T-400',
    name: 'Pavement Works',
    type: 'Summary',
    start: 30,
    duration: 18,
    progress: 8,
    baseline: [30, 48],
    resources: [],
    children: [
      {
        id: 'T-401',
        name: 'Subgrade preparation',
        type: 'Work',
        start: 30,
        duration: 6,
        progress: 25,
        baseline: [30, 36],
        resources: ['E-3'],
        dependencies: [{ taskId: 'T-401', predecessorId: 'T-204', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-402',
        name: 'DBM 50mm layer',
        type: 'Work',
        start: 35,
        duration: 8,
        progress: 0,
        baseline: [36, 44],
        resources: ['E-5', 'L-4'],
        dependencies: [{ taskId: 'T-402', predecessorId: 'T-401', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-403',
        name: 'BC wearing course',
        type: 'Work',
        start: 42,
        duration: 6,
        progress: 0,
        baseline: [44, 50],
        resources: ['E-5'],
        dependencies: [{ taskId: 'T-403', predecessorId: 'T-402', linkType: 'FS', lagWeeks: 0 }],
      },
      {
        id: 'T-404',
        name: 'Road opening milestone',
        type: 'Milestone',
        start: 48,
        duration: 0,
        progress: 0,
        baseline: [50, 50],
        resources: [],
        constraints: 'MFO: Wk 48',
        dependencies: [{ taskId: 'T-404', predecessorId: 'T-403', linkType: 'FS', lagWeeks: 0 }],
      },
    ],
  },
]

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
