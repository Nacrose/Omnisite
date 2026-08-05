'use client'

import { useMemo, memo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEEK_WIDTH, type Task, type DragState } from './types'

/**
 * Props for the Gantt canvas component.
 *
 * The canvas renders the task tree as horizontal bars on a time-grid (one
 * column per week). It handles bar selection, hover, drag-to-move, and
 * drag-to-resize — the actual state lives in the parent `SchedulerModule`
 * and is threaded down via these props.
 *
 * Performance: the canvas uses `React.memo` on `TaskBar` so individual bars
 * don't re-render when unrelated state changes. With 200+ tasks, this is the
 * difference between smooth and janky dragging.
 */
export interface GanttCanvasProps {
  /** The task tree (root-level tasks, each with optional `children`). */
  tasks: Task[]
  /**
   * Flattened task list (from `flattenTasks`) — used for dependency arrow
   * lookup. Each entry pairs the task with its tree depth (for indentation
   * on the canvas).
   */
  flatTasks: { task: Task; depth: number }[]
  /** Set of expanded task IDs (collapsed tasks hide their children). */
  expanded: Set<string>
  /** The currently selected task ID (highlighted on the canvas). */
  selectedId: string
  /** Callback when the user clicks a task bar to select it. */
  onSelect: (id: string) => void
  /** The currently hovered task ID (highlighted on the canvas). */
  hoveredId: string | null
  /** Callback when the user hovers/unhovers a task bar. Pass null to clear. */
  onHover: (id: string | null) => void
  /** Current drag state — null when no drag is in progress, otherwise
   *  contains the task being dragged + the drag offset. */
  dragging: DragState
  /** Callback when the user clicks the expand/collapse chevron on a parent task. */
  onToggleExpand: (id: string) => void
  /** Callback when the user mouse-downs on a task bar body (initiates drag-to-move). */
  onBarMouseDown: (e: React.MouseEvent, t: Task) => void
  /** Callback when the user mouse-downs on a task bar's resize handle (initiates drag-to-resize). */
  onResizeMouseDown: (e: React.MouseEvent, t: Task) => void
  /** Whether to show resource labels on each bar. */
  showResources: boolean
  /** The current week number (drives the red "today" line). Computed from
   *  the active project's start date via `getTodayWeek()`. */
  todayWeek: number
  /**
   * Effective project weeks — dynamically computed from the task tree.
   * Replaces the hardcoded `TOTAL_WEEKS=52` so projects longer than a
   * year aren't truncated.
   */
  totalWeeks: number
  /** Ref to the scrollable canvas container (for measuring scroll position
   *  during drag operations). */
  canvasRef: React.RefObject<HTMLDivElement | null>
}

// ─── Memoized task bar ──────────────────────────────────────────────────────
//
// Extracted from the inline JSX so individual bars don't re-render when
// unrelated state (other bars' hover, selection, drag) changes. Without
// React.memo, hovering bar A would re-render every bar in the canvas —
// acceptable at 20 tasks, janky at 100, unusable at 200. With memo, only
// bar A's props change (isHovered: false → true), so only bar A re-renders.
//
// `task` is reference-stable across renders (it comes from the tasks tree,
// which only changes identity when the underlying data changes), so the
// shallow prop comparison in memo correctly identifies no-op re-renders.

interface TaskBarProps {
  task: Task
  left: number
  width: number
  isHovered: boolean
  isDragging: boolean
  onBarMouseDown: (e: React.MouseEvent, t: Task) => void
  onResizeMouseDown: (e: React.MouseEvent, t: Task) => void
  onHover: (id: string | null) => void
}

const TaskBar = memo(function TaskBar({
  task,
  left,
  width,
  isHovered,
  isDragging,
  onBarMouseDown,
  onResizeMouseDown,
  onHover,
}: TaskBarProps) {
  return (
    <div
      onMouseDown={(e) => onBarMouseDown(e, task)}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group absolute top-1.5 flex h-5 items-center overflow-hidden rounded-sm px-1.5 text-[9px] font-medium text-white shadow-sm transition-shadow',
        isDragging && 'z-30 scale-y-110 cursor-grabbing shadow-lg ring-2 ring-white/50',
        !isDragging && 'cursor-grab hover:shadow-md',
        task.type === 'Summary' && 'bg-muted-foreground/60 cursor-default',
        task.type === 'Hammock' && 'bg-gradient-to-r from-violet-500 to-purple-500',
        task.type === 'Work' && (task.critical ? 'bg-red-500' : 'bg-primary')
      )}
      // `will-change: transform` promotes each bar to its own compositor
      // layer so bar moves/resizes paint without triggering layout on the
      // parent grid. Critical for smooth dragging once we approach ~200
      // task bars in the canvas.
      style={{ left, width, willChange: 'transform' }}
    >
      <div
        className="absolute inset-y-0 left-0 bg-black/20"
        style={{ width: `${task.progress}%` }}
      />
      <span className="pointer-events-none relative z-10 truncate">
        {task.duration}w · {task.progress}%
      </span>
      {/* Resize handles — left edge moves, right edge resizes duration.
          Hidden on Milestone tasks (duration = 0, no point resizing) and
          Summary tasks (start/duration derived from children). Previously
          handles rendered on Milestones too, but `onBarMouseDown` /
          `onResizeMouseDown` silently returned for them — misleading UX
          (audit S7). */}
      {task.type !== 'Summary' && task.type !== 'Milestone' && (
        <>
          {/* Left edge: MOVES the task (same as dragging the body).
              Cursor is grab (not ew-resize) to match the body and signal
              move, not resize (audit R3-7). */}
          <div
            className="absolute top-0 bottom-0 left-0 w-2 cursor-grab bg-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/70"
            onMouseDown={(e) => onBarMouseDown(e, task)}
          />
          {/* Right edge: RESIZES the duration. Cursor is ew-resize. */}
          <div
            className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/70"
            onMouseDown={(e) => onResizeMouseDown(e, task)}
          />
        </>
      )}
      {/* Hover tooltip */}
      {isHovered && !isDragging && (
        <div className="pane text-foreground pointer-events-none absolute -top-7 left-1/2 z-40 -translate-x-1/2 rounded border border-[var(--pane-divider)] px-1.5 py-0.5 text-[9px] whitespace-nowrap shadow-md">
          Wk {task.start + 1} → Wk {task.start + task.duration + 1} · drag body or left edge to
          move, right edge to resize
        </div>
      )}
    </div>
  )
})

// ─── Memoized layout: visible rows + bar positions + arrow paths ────────────
//
// Previously the entire tree walk + position computation + arrow path
// generation ran inside an IIFE in the JSX on EVERY render — so hovering a
// single bar would re-walk the whole task tree and re-build every arrow
// path. The three useMemo calls below split that work by dependency:
//
//   visibleRows   depends on (tasks, expanded)
//   taskPositions depends on (visibleRows)
//   arrowPaths    depends on (taskPositions, flatTasks)
//
// Hover/selection/drag changes no longer invalidate the layout, so they
// no longer trigger a tree walk or path recomputation.

interface VisibleRow {
  task: Task
  depth: number
  rowIndex: number
  left: number
  width: number
  baseLeft: number
  baseWidth: number
  varianceWeeks: number
}

function buildVisibleRows(tasks: Task[], expanded: Set<string>): VisibleRow[] {
  const out: VisibleRow[] = []
  let rowIndex = 0
  const walk = (items: Task[], depth: number) => {
    for (const t of items) {
      const left = t.start * WEEK_WIDTH
      const width = Math.max(t.duration * WEEK_WIDTH, t.type === 'Milestone' ? 12 : 6)
      // Guard: baseline may be undefined if the task was loaded from
      // Supabase with NULL baseline_start/baseline_finish columns (fromDb
      // only sets `baseline` when both columns are non-undefined). Fall
      // back to [start, start + duration] so the baseline ghost renders
      // directly under the bar (zero variance) instead of crashing
      // (audit R5-2 — previously t.baseline[0] threw "Cannot read
      // properties of undefined" for tasks with no baseline).
      const baseline = t.baseline ?? [t.start, t.start + t.duration]
      const baseLeft = baseline[0] * WEEK_WIDTH
      const baseWidth = Math.max((baseline[1] - baseline[0]) * WEEK_WIDTH, 4)
      const varianceWeeks = t.start - baseline[0]
      out.push({ task: t, depth, rowIndex, left, width, baseLeft, baseWidth, varianceWeeks })
      rowIndex++
      if (t.children && t.children.length > 0 && expanded.has(t.id)) {
        walk(t.children, depth + 1)
      }
    }
  }
  walk(tasks, 0)
  return out
}

interface BarPosition {
  rowIndex: number
  barLeft: number
  barRight: number
  barTop: number
}

function buildBarPositions(rows: VisibleRow[]): Map<string, BarPosition> {
  const m = new Map<string, BarPosition>()
  // Row height is 32px (h-8); bar vertical center is at rowIndex*32 + 16.
  for (const r of rows) {
    m.set(r.task.id, {
      rowIndex: r.rowIndex,
      barLeft: r.left,
      barRight: r.left + r.width,
      barTop: r.rowIndex * 32 + 16,
    })
  }
  return m
}

interface ArrowPath {
  key: string
  d: string
  isCritical: boolean
}

function buildArrowPaths(
  positions: Map<string, BarPosition>,
  flatTasks: { task: Task; depth: number }[]
): ArrowPath[] {
  const out: ArrowPath[] = []
  // Build a task-id → task lookup map so we don't do an O(n) find() inside
  // the loop (was O(n²) for the whole path-building pass).
  const taskById = new Map<string, Task>()
  for (const { task } of flatTasks) taskById.set(task.id, task)
  for (const [taskId, pos] of positions) {
    const task = taskById.get(taskId)
    if (!task?.dependencies) continue
    for (const dep of task.dependencies) {
      const predPos = positions.get(dep.predecessorId)
      if (!predPos) continue
      // x1 is the point on the predecessor bar that drives the link:
      //   SS/SF come off the predecessor's START  (left edge)
      //   FS/FF come off the predecessor's FINISH (right edge)
      // x2 is the point on the successor bar the arrow points to:
      //   FF/SF point at the successor's FINISH (right edge)
      //   FS/SS point at the successor's START  (left edge)
      // Without this, every arrow was drawn FS-style (pred right → succ left)
      // regardless of linkType — visually wrong for SS/FF/SF links and a
      // misleading picture of the schedule logic.
      const linkType = dep.linkType || 'FS'
      const x1 = linkType === 'SS' || linkType === 'SF' ? predPos.barLeft : predPos.barRight
      const x2 = linkType === 'FF' || linkType === 'SF' ? pos.barRight : pos.barLeft
      const y1 = predPos.barTop
      const y2 = pos.barTop
      // Elbow path: right from predecessor finish, down/up to successor row,
      // left to successor start.
      const midX = Math.max(x1 + 8, x2 - 8)
      const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
      // Stable key: successorId → predecessorId : linkType. Previously used
      // `arrow-${i++}` which renumbered when tasks were added/removed,
      // causing React to reuse wrong DOM nodes (visual glitches like wrong
      // stroke color or wrong path) (audit R3-6).
      out.push({
        key: `${taskId}-${dep.predecessorId}-${linkType}`,
        d,
        isCritical: !!task.critical,
      })
    }
  }
  return out
}

// ─── Main canvas ────────────────────────────────────────────────────────────

export function GanttCanvas({
  tasks,
  flatTasks,
  expanded,
  selectedId,
  onSelect,
  hoveredId,
  onHover,
  dragging,
  onToggleExpand,
  onBarMouseDown,
  onResizeMouseDown,
  showResources,
  todayWeek,
  totalWeeks,
  canvasRef,
}: GanttCanvasProps) {
  // Only re-walk the task tree when the tasks themselves or the expanded
  // set changes — NOT on hover/selection/drag updates.
  const visibleRows = useMemo(() => buildVisibleRows(tasks, expanded), [tasks, expanded])

  // Bar positions are a pure function of the visible rows, so they inherit
  // the same memoization benefit.
  const taskPositions = useMemo(() => buildBarPositions(visibleRows), [visibleRows])

  // SVG path data for dependency arrows — only recomputed when bar positions
  // or the flat task list (used to look up dependencies) change.
  const arrowPaths = useMemo(
    () => buildArrowPaths(taskPositions, flatTasks),
    [taskPositions, flatTasks]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Gantt canvas */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Week ruler */}
          <div className="vibrancy sticky top-0 z-10 flex h-8 border-b border-[var(--pane-divider)]">
            <div className="text-muted-foreground flex w-[480px] flex-shrink-0 items-center border-r border-[var(--pane-divider)] px-3 text-[10px] font-semibold tracking-wider uppercase">
              Task
            </div>
            <div className="flex" style={{ width: totalWeeks * WEEK_WIDTH }}>
              {Array.from({ length: totalWeeks }).map((_, i) => {
                const isMonthStart = i % 4 === 0
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-shrink-0 items-center justify-center border-r border-[var(--pane-divider)] text-center text-[10px]',
                      isMonthStart ? 'text-foreground font-semibold' : 'text-muted-foreground'
                    )}
                    style={{ width: WEEK_WIDTH }}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Task rows with gantt bars */}
          <div ref={canvasRef} className="relative">
            {visibleRows.map((r) => {
              const t = r.task
              const isExpanded = expanded.has(t.id)
              const hasChildren = !!(t.children && t.children.length > 0)
              const isSelected = t.id === selectedId
              const isHovered = hoveredId === t.id
              const isDragging = dragging?.id === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={cn(
                    'row-hover flex cursor-pointer items-stretch border-b border-[var(--pane-divider)] transition-colors',
                    isSelected && 'bg-accent/40',
                    t.critical && 'bg-red-500/5'
                  )}
                >
                  <div
                    className="flex w-[480px] flex-shrink-0 items-center border-r border-[var(--pane-divider)] text-xs"
                    style={{ paddingLeft: `${r.depth * 16 + 8}px` }}
                  >
                    <div className="w-6">
                      {hasChildren && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleExpand(t.id)
                          }}
                          className="p-0.5"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <span className="text-muted-foreground w-16 font-mono text-[10px]">{t.id}</span>
                    <span
                      className={cn(
                        'truncate',
                        t.type === 'Summary' && 'font-semibold',
                        t.critical && 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {t.name}
                    </span>
                    {r.varianceWeeks !== 0 && t.type === 'Work' && (
                      <span
                        className={cn(
                          'ml-2 rounded px-1 font-mono text-[9px]',
                          r.varianceWeeks > 0
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        )}
                      >
                        {r.varianceWeeks > 0 ? '+' : ''}
                        {r.varianceWeeks}w
                      </span>
                    )}
                  </div>
                  <div
                    className="gantt-grid relative h-8"
                    style={{ width: totalWeeks * WEEK_WIDTH }}
                  >
                    {/* Baseline ghost */}
                    <div
                      className="border-muted-foreground/40 bg-muted-foreground/5 absolute top-2.5 h-3 rounded-sm border border-dashed"
                      style={{ left: r.baseLeft, width: r.baseWidth }}
                    />
                    {/* Bar */}
                    {t.type === 'Milestone' ? (
                      <div
                        className="absolute top-1/2 h-0 w-0 -translate-y-1/2"
                        style={{
                          left: r.left - 6,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderBottom: '10px solid var(--warning)',
                          willChange: 'transform',
                        }}
                      />
                    ) : (
                      <TaskBar
                        task={t}
                        left={r.left}
                        width={r.width}
                        isHovered={isHovered}
                        isDragging={isDragging}
                        onBarMouseDown={onBarMouseDown}
                        onResizeMouseDown={onResizeMouseDown}
                        onHover={onHover}
                      />
                    )}
                  </div>
                </div>
              )
            })}

            {/* SVG overlay for dependency arrows. Pointer-events none so
                it doesn't intercept bar clicks/drag. */}
            <svg
              className="pointer-events-none absolute top-0 left-[480px] z-[15]"
              width={totalWeeks * WEEK_WIDTH}
              height={visibleRows.length * 32}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker
                  id="arrowhead-critical"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 6 3, 0 6" fill="#ef4444" />
                </marker>
                <marker
                  id="arrowhead-normal"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 6 3, 0 6" fill="rgba(100, 116, 139, 0.6)" />
                </marker>
              </defs>
              {arrowPaths.map((a) => (
                <path
                  key={a.key}
                  d={a.d}
                  stroke={a.isCritical ? '#ef4444' : 'rgba(100, 116, 139, 0.4)'}
                  strokeWidth={a.isCritical ? 1.5 : 1}
                  fill="none"
                  markerEnd={`url(#arrowhead-${a.isCritical ? 'critical' : 'normal'})`}
                />
              ))}
            </svg>

            {/* Today vertical line */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
              style={{ left: `calc(480px + ${todayWeek * WEEK_WIDTH}px)` }}
            >
              <div className="absolute -top-0 -translate-x-1/2 rounded-b bg-red-500 px-1 py-0.5 text-[9px] font-semibold text-white">
                TODAY
              </div>
            </div>
          </div>

          {/* Resource usage panel (toggle).
              Renders an actual per-week bar chart of resource load — the
              count of resource codes assigned to active tasks in each week
              (same definition `leveling.ts` uses for its peak-smoothing
              heuristic). Previously this rendered fake sine waves and was
              later replaced with an "always placeholder" message — but
              that meant the toggle did nothing even when tasks had real
              `resources: ['M-1', 'E-3', ...]` arrays. Now it shows the
              real load so users can spot over-allocation weeks (audit S9).

              The bars are colored amber when load = peak (so the user can
              see at a glance which weeks leveling would target). */}
          {showResources && <ResourceLoadChart tasks={tasks} totalWeeks={totalWeeks} />}
        </div>
      </div>
    </div>
  )
}

// ─── Resource load chart ────────────────────────────────────────────────────
//
// Renders a per-week bar chart of resource load — the count of resource
// codes assigned to active tasks in each week. Same definition `leveling.ts`
// uses for its peak-smoothing heuristic. Bars at peak load are colored
// amber so the user can spot the weeks leveling would target.
//
// Memoized so it only recomputes when the task tree actually changes —
// hovering / dragging bars doesn't invalidate the chart.

function computeWeeklyLoad(tasks: Task[], totalWeeks: number): { load: number[]; peak: number } {
  const load = new Array(totalWeeks).fill(0)
  const walk = (items: Task[]) => {
    for (const t of items) {
      // Include Hammock tasks in the load calculation — they have durations
      // and resources (e.g. seed T-301 has resources: ['L-3']). This must
      // match leveling.ts's flattenLeaves which was fixed in R6-2 to include
      // Hammock tasks. Without this, the chart and leveling would disagree
      // on the peak load (audit S8-2).
      if ((t.type === 'Work' || t.type === 'Hammock') && t.duration > 0) {
        const resources = t.resources ?? []
        for (let w = t.start; w < t.start + t.duration && w < totalWeeks; w++) {
          load[w] += resources.length
        }
      }
      if (t.children) walk(t.children)
    }
  }
  walk(tasks)
  const peak = Math.max(1, ...load)
  return { load, peak }
}

export const ResourceLoadChart = memo(function ResourceLoadChart({
  tasks,
  totalWeeks,
}: {
  tasks: Task[]
  totalWeeks: number
}) {
  const { load, peak } = useMemo(() => computeWeeklyLoad(tasks, totalWeeks), [tasks, totalWeeks])
  const hasAnyLoad = load.some((v) => v > 0)
  const barHeight = 32 // px

  return (
    <div className="bg-secondary/20 border-t-2 border-[var(--pane-divider)]">
      <div className="text-muted-foreground flex items-center justify-between px-3 py-2 text-[10px] font-semibold tracking-wider uppercase">
        <span>Resource Load · resource units per week</span>
        <span className="font-mono normal-case">
          peak {peak} · {hasAnyLoad ? 'amber = peak weeks' : 'no resources assigned'}
        </span>
      </div>
      {!hasAnyLoad ? (
        <div className="text-muted-foreground flex items-center justify-center px-4 py-4 text-center text-[11px]">
          No resource codes assigned to any Work task. Use the inspector&apos;s Assign tab once
          resource assignments are wired in.
        </div>
      ) : (
        // Flex row: 480px task-name spacer (matches the Gantt rows above so
        // week N of the chart lines up with week N of the Gantt) + the
        // bar chart timeline. Without the spacer the chart was misaligned
        // by 480px (audit R3-2).
        <div className="flex items-stretch">
          <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)]" />
          <div
            className="flex items-end"
            style={{ width: totalWeeks * WEEK_WIDTH, height: barHeight + 8 }}
          >
            {load.map((v, i) => {
              const isPeak = v === peak && v > 0
              const h = v === 0 ? 1 : Math.max(2, (v / peak) * barHeight)
              return (
                <div
                  key={i}
                  className="flex-shrink-0 border-r border-[var(--pane-divider)]"
                  style={{
                    width: WEEK_WIDTH,
                    height: barHeight + 8,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                  title={`Wk ${i + 1}: ${v} resource unit${v === 1 ? '' : 's'}`}
                >
                  <div
                    className={cn(
                      'w-3/4 rounded-t-sm',
                      isPeak ? 'bg-amber-500/70' : v > 0 ? 'bg-primary/60' : 'bg-transparent'
                    )}
                    style={{ height: h }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})
