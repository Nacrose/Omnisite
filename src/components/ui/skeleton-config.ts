/**
 * Skeleton animation speed config + per-module layout specs.
 *
 * ┌─ TO TWEAK ANIMATION SPEED ────────────────────────────────────────┐
 * │  Change `SPEED.multiplier` below.                                │
 * │  • 1.0 = default (balanced)                                      │
 * │  • 2.0 = 2× faster (snappier)                                    │
 * │  • 0.5 = half speed (more dramatic)                              │
 * │                                                                  │
 * │  All durations (typewriter, stagger, fly-in) are divided by      │
 * │  this multiplier, so it's the single knob.                       │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * The skeleton is NON-BLOCKING: it only renders while the module's
 * `loading` flag is true. The moment data arrives, the skeleton
 * unmounts and real content takes its place — no minimum display time,
 * no waiting for the animation to finish.
 */

export const SPEED = {
  /** Master multiplier — increase to speed up ALL animations. */
  multiplier: 1.0,

  /** Typewriter: characters per second (before multiplier). */
  typeCps: 50,

  /** Stagger between cells in a row, ms (before multiplier). */
  cellStagger: 20,

  /** Stagger between rows, ms (before multiplier). */
  rowStagger: 50,

  /** Fly-in animation duration, ms (before multiplier). */
  flyInMs: 200,

  /** Fade-out when real content replaces skeleton, ms. */
  fadeMs: 120,
} as const

// ─── Derived helpers (divide by multiplier) ─────────────────────────────────

export const typeIntervalMs = () => 1000 / (SPEED.typeCps * SPEED.multiplier)
export const cellDelay = (i: number) => (SPEED.cellStagger / SPEED.multiplier) * i
export const rowDelay = (i: number) => (SPEED.rowStagger / SPEED.multiplier) * i
export const flyInDuration = () => SPEED.flyInMs / SPEED.multiplier

// ─── Layout types ───────────────────────────────────────────────────────────

export interface SkeletonColumn {
  /** Header text to type out. */
  label: string
  /** CSS width class (e.g. 'w-16', 'flex-1'). */
  width: string
  align?: 'left' | 'right' | 'center'
}

export interface SkeletonLayout {
  /** Layout pattern. */
  pattern:
    | 'table+inspector'
    | '3-pane'
    | 'kpi+charts'
    | 'tree+table'
    | 'full-table'
    | 'chat'
    | 'tabs+table'
  /** Center grid columns (for table patterns). */
  columns: SkeletonColumn[]
  /** Number of data rows. */
  rows: number
  /** Left pane (for 3-pane / tree+table). */
  leftPane?: { rows: number; label: string }
  /** Right pane (for table+inspector / 3-pane). */
  rightPane?: { label: string; fields: number }
  /** Tab labels (for tabs+table). */
  tabs?: string[]
  /** KPI card labels (for kpi+charts). */
  kpiCards?: string[]
  /** Gantt bar count (for 3-pane scheduler). */
  ganttBars?: number
}

// ─── Per-module layouts ─────────────────────────────────────────────────────
//
// Each layout mirrors the real module structure so the skeleton feels
// like the actual UI being constructed.

export const MODULE_LAYOUTS: Record<string, SkeletonLayout> = {
  // ─── BOQ ──────────────────────────────────────────────────────────────
  // Center grid (Code/Desc/Qty/UOM/Rate/Amount/Type) + right RA inspector
  boq: {
    pattern: 'table+inspector',
    columns: [
      { label: 'Code', width: 'w-16' },
      { label: 'Description', width: 'flex-1' },
      { label: 'Qty', width: 'w-14', align: 'right' },
      { label: 'UOM', width: 'w-12' },
      { label: 'Rate', width: 'w-20', align: 'right' },
      { label: 'Amount', width: 'w-24', align: 'right' },
    ],
    rows: 8,
    rightPane: { label: 'RA Inspector', fields: 7 },
  },

  // ─── Scheduler ────────────────────────────────────────────────────────
  // Left task outline + center Gantt + right task inspector
  scheduler: {
    pattern: '3-pane',
    columns: [
      { label: 'ID', width: 'w-20' },
      { label: 'Task Name', width: 'flex-1' },
      { label: 'Dur', width: 'w-14', align: 'right' },
      { label: '%', width: 'w-12', align: 'right' },
    ],
    rows: 6,
    leftPane: { rows: 6, label: 'Task Outline' },
    rightPane: { label: 'Task Inspector', fields: 6 },
    ganttBars: 6,
  },

  // ─── Dashboard ───────────────────────────────────────────────────────
  // KPI strip + charts + location map
  dashboard: {
    pattern: 'kpi+charts',
    columns: [],
    rows: 0,
    kpiCards: ['Schedule Progress', 'Cost Variance', 'Forecast Cost', 'Budget Margin'],
  },

  // ─── Daily Ops ───────────────────────────────────────────────────────
  'daily-ops': {
    pattern: 'table+inspector',
    columns: [
      { label: 'Date', width: 'w-20' },
      { label: 'Task', width: 'flex-1' },
      { label: 'Chainage', width: 'w-20' },
      { label: 'Planned', width: 'w-14', align: 'right' },
      { label: 'Actual', width: 'w-14', align: 'right' },
    ],
    rows: 6,
    rightPane: { label: 'DSR Inspector', fields: 6 },
  },

  // ─── Procurement ─────────────────────────────────────────────────────
  procurement: {
    pattern: 'tabs+table',
    columns: [
      { label: 'Req #', width: 'w-20' },
      { label: 'Item', width: 'flex-1' },
      { label: 'Vendor', width: 'w-28' },
      { label: 'Qty', width: 'w-14', align: 'right' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 6,
    tabs: ['Requisitions', 'Purchase Orders', 'GRNs', 'Stock'],
    rightPane: { label: 'Inspector', fields: 5 },
  },

  // ─── Financials ──────────────────────────────────────────────────────
  financials: {
    pattern: 'tree+table',
    columns: [
      { label: 'CBS Code', width: 'w-24' },
      { label: 'Description', width: 'flex-1' },
      { label: 'Budget', width: 'w-24', align: 'right' },
      { label: 'Actual', width: 'w-24', align: 'right' },
      { label: 'Forecast', width: 'w-24', align: 'right' },
    ],
    rows: 7,
    leftPane: { rows: 8, label: 'CBS Tree' },
  },

  // ─── Vendors ─────────────────────────────────────────────────────────
  vendors: {
    pattern: 'tabs+table',
    columns: [
      { label: 'Name', width: 'flex-1' },
      { label: 'Category', width: 'w-24' },
      { label: 'Contact', width: 'w-28' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 6,
    tabs: ['All', 'Suppliers', 'Subcontractors'],
  },

  // ─── Drawings ────────────────────────────────────────────────────────
  drawings: {
    pattern: 'table+inspector',
    columns: [
      { label: 'Number', width: 'w-24' },
      { label: 'Title', width: 'flex-1' },
      { label: 'Discipline', width: 'w-24' },
      { label: 'Rev', width: 'w-12' },
      { label: 'Date', width: 'w-20' },
    ],
    rows: 6,
    rightPane: { label: 'Drawing Viewer', fields: 4 },
  },

  // ─── Correspondence ──────────────────────────────────────────────────
  correspondence: {
    pattern: 'full-table',
    columns: [
      { label: 'Date', width: 'w-20' },
      { label: 'From / To', width: 'w-32' },
      { label: 'Subject', width: 'flex-1' },
      { label: 'Type', width: 'w-20' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 8,
  },

  // ─── Q&S ─────────────────────────────────────────────────────────────
  qs: {
    pattern: 'table+inspector',
    columns: [
      { label: 'ID', width: 'w-20' },
      { label: 'Title', width: 'flex-1' },
      { label: 'Type', width: 'w-20' },
      { label: 'Status', width: 'w-20' },
      { label: 'Date', width: 'w-20' },
    ],
    rows: 6,
    rightPane: { label: 'Q&S Inspector', fields: 6 },
  },

  // ─── Equipment ───────────────────────────────────────────────────────
  equipment: {
    pattern: 'full-table',
    columns: [
      { label: 'ID', width: 'w-20' },
      { label: 'Name', width: 'flex-1' },
      { label: 'Type', width: 'w-24' },
      { label: 'Hours', width: 'w-16', align: 'right' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 6,
  },

  // ─── Reports ─────────────────────────────────────────────────────────
  reports: {
    pattern: 'full-table',
    columns: [
      { label: 'Report', width: 'flex-1' },
      { label: 'Type', width: 'w-24' },
      { label: 'Last Run', width: 'w-24' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 5,
  },

  // ─── Time & Attendance ───────────────────────────────────────────────
  'time-attendance': {
    pattern: 'table+inspector',
    columns: [
      { label: 'ID', width: 'w-16' },
      { label: 'Name', width: 'flex-1' },
      { label: 'Trade', width: 'w-24' },
      { label: 'Hours', width: 'w-16', align: 'right' },
      { label: 'OT', width: 'w-14', align: 'right' },
    ],
    rows: 8,
    rightPane: { label: 'Payroll', fields: 5 },
  },

  // ─── Admin ───────────────────────────────────────────────────────────
  admin: {
    pattern: 'tabs+table',
    columns: [
      { label: 'Name', width: 'flex-1' },
      { label: 'Role', width: 'w-24' },
      { label: 'Email', width: 'w-40' },
      { label: 'Status', width: 'w-20' },
    ],
    rows: 6,
    tabs: ['Users', 'Materials', 'Rates', 'Locations', 'Presets'],
  },

  // ─── Chat ────────────────────────────────────────────────────────────
  chat: {
    pattern: 'chat',
    columns: [],
    rows: 0,
  },
}

// ─── Module detection ───────────────────────────────────────────────────────

/**
 * Get the skeleton layout for a module ID. Falls back to a generic
 * table layout for unknown modules.
 */
export function getLayout(moduleId: string): SkeletonLayout {
  return (
    MODULE_LAYOUTS[moduleId] ?? {
      pattern: 'full-table',
      columns: [
        { label: 'Name', width: 'flex-1' },
        { label: 'Status', width: 'w-20' },
        { label: 'Date', width: 'w-20' },
      ],
      rows: 6,
    }
  )
}
