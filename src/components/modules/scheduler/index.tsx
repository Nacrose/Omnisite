'use client'

import { useState, useRef, useEffect } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Search, Plus, Gauge, ChevronRight, ChevronDown, Flag, Layers, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { undoableToast } from '@/components/ui/confirm-dialog'
import { TASKS, TOTAL_WEEKS, WEEK_WIDTH, flattenTasks, type Task, type DragState } from './types'
import { GanttCanvas } from './gantt-canvas'
import { TaskInspector } from './task-inspector'
import { AddTaskModal, CriticalPathBreachModal, EMPTY_NEW_TASK, type NewTaskDraft } from './modals'
import { calculateCpm, type CpmTask } from '@/lib/cpm'
import { levelResources } from './leveling'
import { useMemo, useCallback } from 'react'
import { produce } from 'immer'
import { flattenTree, rebuildTreeFromRows } from '@/lib/tree-utils'

/**
 * Flatten a Task tree for DB storage. Strips `children` and sets `parentId`
 * on each row. Mirrors the BOQ module's `flattenBoqTree` — the scheduler
 * persists flat rows to the `tasks` table (with `parent_id` FK) and rebuilds
 * the tree on load, so child tasks round-trip through Supabase instead of
 * being silently dropped by useSyncedState's top-level-only upsert.
 */
function flattenTaskTree(items: Task[], parentId: string | null = null): Task[] {
  return flattenTree(items as unknown as Record<string, unknown>[], parentId) as unknown as Task[]
}

// TODO: replace with real project epoch once project settings exist.
// For now, use a fixed epoch so the TODAY line is deterministic and moves
// forward as real time passes (previously hardcoded to `16`, which kept
// the red marker pinned at week 16 forever).
const PROJECT_EPOCH = new Date('2026-04-01') // approx project start
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export function SchedulerModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
  const [selectedId, setSelectedId] = usePersistentState('omnisite-scheduler-selected', 'T-203')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>(
    'omnisite-scheduler-expanded',
    ['T-100', 'T-200', 'T-300', 'T-400']
  )
  const [tasks, setTasks, tasksLoading] = useSyncedState<Task[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => structuredClone(TASKS) as typeof TASKS,
    {
      fieldMap: {
        start: 'start_week',
        duration: 'duration',
        // NOTE: `baseline` (a `[start, finish]` tuple) is intentionally NOT
        // in the fieldMap. The tasks table has no `baseline` JSONB column —
        // it has two separate INTEGER columns `baseline_start` and
        // `baseline_finish` (migration 00000000000000). The previous
        // `baseline: 'baseline_finish'` mapping wrote a JSON-stringified
        // array into an INTEGER column, which PostgREST rejected (or
        // silently zeroed) so baselines never round-tripped.
        //
        // The split-on-write / reconstruct-on-read logic now lives in
        // `toDb` / `fromDb` inside use-synced-state.ts (special-cased on
        // the `baseline` array key, since only the tasks table has these
        // columns). The explicit no-op mappings below for baselineStart /
        // baselineFinish are listed for clarity so future contributors
        // don't accidentally re-add `baseline` to the fieldMap.
        baselineStart: 'baseline_start',
        baselineFinish: 'baseline_finish',
        constraints: 'constraints',
        parentId: 'parent_id',
        // Explicit no-op mapping so the dependencies JSON string survives
        // the camelToSnake auto-convert (which would otherwise also produce
        // 'dependencies' — listed here for clarity so future contributors
        // don't accidentally drop it). Without this, Zod's taskSchema (now
        // extended to accept `dependencies`) would still receive the field,
        // but the round-trip is now end-to-end explicit.
        dependencies: 'dependencies',
        // location_id column added in migration 12 — round-trips the
        // work-face link so it persists across reloads and is visible to
        // other modules.
        locationId: 'location_id',
        // Explicit no-op mapping for `resources` (a string[] on the Task
        // type). Without this, the camelToSnake auto-convert would still
        // produce `resources: 'resources'`, but listing it here documents
        // that the column exists (migration 18) and is round-tripped. The
        // field is JSON-serialized before POSTing (same pattern as
        // `dependencies`) so the JSONB column receives a string.
        // Without a guard, a row that comes back from Supabase with
        // resources === null (e.g. an old row pre-dating migration 18)
        // would crash resource leveling (leveling.ts accesses
        // t.resources.length); leveling now null-guards this.
        resources: 'resources',
      },
      primaryKey: 'id',
    }
  )
  // Non-persistent UI state
  const [showResources, setShowResources] = useState(false)
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [dragging, setDragging] = useState<DragState>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Search query — filters the task outline by id/name.
  const [searchQuery, setSearchQuery] = useState('')
  // EOT / Critical Path Breach modal
  const [breachModal, setBreachModal] = useState(false)
  const [breachTask, setBreachTask] = useState<Task | null>(null)
  // Convert expanded array to Set for O(1) lookups. Memoized so the Set
  // instance is stable across renders when `expandedArr` hasn't changed —
  // without this, every render produces a new Set, busting the `useMemo`
  // cache on `buildVisibleRows(tasks, expanded)` (and forcing the Gantt
  // canvas to re-walk the entire task tree on every unrelated re-render).
  const expanded = useMemo(() => new Set(expandedArr), [expandedArr])

  // Rebuild the task tree from the flat rows in `tasks`.
  //
  // `useSyncedState` stores flat rows (one row per task, parent_id FK) and
  // only upserts top-level items in the array. Without this rebuild, every
  // reload would lose the parent/child nesting and `flattenTasks` / CPM /
  // the Gantt would see a flat list at depth 0. Mirrors the BOQ module's
  // `rebuildBoqTree(boqRows)`.
  //
  // Memoized on `tasks` so the tree isn't rebuilt on every render — only
  // when the underlying flat rows actually change. If `tasks` already
  // contains nested children (e.g. seed data or in-memory state before the
  // first save), `rebuildTreeFromRows` returns it as-is.
  const taskTree = useMemo(
    () =>
      rebuildTreeFromRows(
        tasks as unknown as Record<string, unknown>[],
        'id',
        'parentId'
      ) as unknown as Task[],
    [tasks]
  )

  /**
   * Commit a new task-tree state. Flattens the tree before calling setTasks
   * so child rows are persisted to the DB (useSyncedState only upserts
   * top-level items in the array — without flattening, child tasks would
   * never be written to Supabase and would disappear on reload).
   *
   * The updater receives the current tree (rebuilt from the flat rows in
   * state) and must return the next tree. Mirrors the BOQ module's
   * `commitBoqData`.
   */
  const commitTasks = (updater: (prevTree: Task[]) => Task[]): void => {
    setTasks((prevFlat) => {
      const prevTree =
        prevFlat && prevFlat.length > 0
          ? (rebuildTreeFromRows(
              prevFlat as unknown as Record<string, unknown>[],
              'id',
              'parentId'
            ) as unknown as Task[])
          : []
      const nextTree = updater(prevTree)
      return flattenTaskTree(nextTree)
    })
  }

  // Real CPM calculation — compute critical path from task dependencies.
  // Each task's `dependencies` array (TaskDependency[]) is passed through to
  // calculateCpm with full link type (FS/SS/FF/SF) and lag information, so
  // the forward/backward pass uses correct finish/start constraints.
  // Summary tasks are excluded from CPM input: they're roll-ups (their
  // start/finish are derived from children, not scheduled). Including them
  // would inject phantom predecessors and corrupt the critical path (C9).
  //
  // Hammock tasks ARE included (audit R5-3 — previously excluded, which
  // meant any task with an SS/FS dep on a Hammock lost its predecessor in
  // the CPM network and got an incorrectly large float. e.g. T-302 SS on
  // T-301: with T-301 excluded, T-302 had no deps → ES=0 → float=14; with
  // T-301 included, T-302's SS dep gives ES=14 → float=0, correctly
  // identifying T-302 as near-critical).
  const cpmResult = useMemo(() => {
    const flat = flattenTasks(taskTree)
    const cpmTasks: CpmTask[] = flat
      .filter(({ task }) => task.type !== 'Summary')
      .map(({ task }) => ({
        id: task.id,
        duration: task.duration,
        dependencies: (task.dependencies || []).map((d) => ({
          predecessorId: d.predecessorId,
          linkType: d.linkType,
          lag: d.lagWeeks,
        })),
      }))
    try {
      const result = calculateCpm(cpmTasks)
      return result
    } catch (err) {
      // CPM threw — most likely a dependency cycle (calculateCpm detects
      // cycles and throws with a descriptive message). Surface the error
      // via console.warn so devs can diagnose, and fall back to the
      // seed-decorated critical flags so the UI doesn't crash. The
      // fallback isn't correct (the seed flags may be stale), but it's
      // better than rendering nothing (audit S5 — previously this catch
      // silently swallowed all errors with no console output).
      // eslint-disable-next-line no-console
      console.warn('[Scheduler] CPM calculation failed:', err instanceof Error ? err.message : err)
      return null
    }
  }, [taskTree])

  // Apply CPM critical path to tasks (override the decorative boolean)
  const tasksWithCpm = useMemo(() => {
    if (!cpmResult) return taskTree
    const updateTasks = (items: Task[]): Task[] => {
      return items.map((t) => {
        const cpmData = cpmResult.results[t.id]
        const isCritical = cpmData ? cpmData.isCritical : t.critical
        const updated = { ...t, critical: isCritical }
        if (t.children) {
          updated.children = updateTasks(t.children)
        }
        return updated
      })
    }
    return updateTasks(taskTree)
  }, [taskTree, cpmResult])
  // Add Task modal state
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState<NewTaskDraft>(EMPTY_NEW_TASK)

  // Memoize the flatten so it only recomputes when `tasksWithCpm` actually
  // changes. Without this, every unrelated re-render (e.g. hovering a task,
  // dragging the gantt canvas) would re-walk the entire task tree twice.
  const flat = useMemo(() => flattenTasks(tasksWithCpm), [tasksWithCpm])
  const selectedTask = flat.find((f) => f.task.id === selectedId)?.task ?? flat[0]?.task ?? null

  // If selectedId points to a task that no longer exists (deleted, or stale
  // persisted ID), selectedTask falls back to flat[0] — but selectedId in
  // state is still the stale ID, so the outline highlights NO row. Sync
  // selectedId to the fallback so the outline highlights the right row
  // (audit R6-6). Uses the "adjust state during render" pattern to avoid
  // the lint violation that useEffect+setState would trigger.
  if (selectedTask && selectedTask.id !== selectedId) {
    setSelectedId(selectedTask.id)
  }

  // Project finish — the latest end-week (start + duration) across all
  // LEAF tasks. Previously this used all tasks including Summary, whose
  // duration can be stale (not yet recomputed from children), inflating
  // the reported finish week. Leaf tasks (Work, Milestone, Hammock) have
  // authoritative durations (audit R6-9).
  const projectFinishWeek = useMemo(
    () =>
      flat.length > 0
        ? Math.max(
            ...flat
              .filter((f) => !f.task.children || f.task.children.length === 0)
              .map((f) => f.task.start + f.task.duration)
          )
        : 0,
    [flat]
  )

  // Update a task's start date when dragged
  const updateTaskStart = (id: string, newStart: number) => {
    commitTasks((prev) =>
      produce(prev, (draft) => {
        const walk = (items: Task[]) => {
          for (const t of items) {
            if (t.id === id) {
              t.start = Math.max(0, Math.min(TOTAL_WEEKS - t.duration, newStart))
              return true
            }
            if (t.children && walk(t.children)) return true
          }
          return false
        }
        walk(draft as Task[])
      })
    )
  }

  // Update a task's duration when resized
  const updateTaskDuration = (id: string, newDuration: number) => {
    commitTasks((prev) =>
      produce(prev, (draft) => {
        const walk = (items: Task[]) => {
          for (const t of items) {
            if (t.id === id) {
              t.duration = Math.max(1, Math.min(TOTAL_WEEKS - t.start, newDuration))
              return true
            }
            if (t.children && walk(t.children)) return true
          }
          return false
        }
        walk(draft as Task[])
      })
    )
  }

  // Update a task's progress from the inspector input. Walks the tree so
  // nested children are found. Clamps to [0, 100]. Previously progress was
  // read-only in the inspector — the only way to update it was to drag
  // bars, which doesn't change progress at all (audit S13).
  const updateTaskProgress = (id: string, newProgress: number) => {
    commitTasks((prev) =>
      produce(prev, (draft) => {
        const walk = (items: Task[]) => {
          for (const t of items) {
            if (t.id === id) {
              t.progress = Math.max(0, Math.min(100, newProgress))
              return true
            }
            if (t.children && walk(t.children)) return true
          }
          return false
        }
        walk(draft as Task[])
      })
    )
  }

  // Add a new task to the top level
  const addTask = () => {
    // Time-based ID so concurrent adds (or two sessions creating tasks at
    // the same second) don't collide. Previously `T-${500 + taskNum}` would
    // clash with seed task IDs once the count grew past 100, and would
    // duplicate IDs if tasks were deleted and re-added.
    const newId = `T-${Date.now().toString(36)}`
    const isMilestone = newTask.type === 'Milestone'
    const isSummary = newTask.type === 'Summary'
    // Milestones have duration 0. Summary tasks start with duration 0 —
    // it's derived from children once children are added (the leveling
    // rebuild and the Gantt's buildVisibleRows both handle this, but the
    // initial Summary should not carry a stale duration from the input
    // field, which would show a misleading "5w" in the outline until the
    // first leveling pass (audit R6-3).
    const duration = isMilestone || isSummary ? 0 : newTask.duration
    const finishWeek = newTask.start + duration
    // Build the constraint string. For MFO/MSO, auto-default to the task's
    // finish/start week so the breach detector has a week to compare against
    // (audit R3-5 — previously the modal wrote a bare 'MFO' with no week,
    // so breach detection never fired until the user opened the inspector
    // and set a week manually). The inspector's deadline-week input will
    // show the auto-defaulted value, and the user can edit it from there.
    let constraints = newTask.constraints
    if (constraints === 'MFO' || constraints === 'MSO') {
      // For MFO use finish week; for MSO use start week. For Milestones
      // (duration 0) finish = start, so both use start week.
      const deadlineWeek = constraints === 'MFO' ? finishWeek : newTask.start
      constraints = `${constraints}: Wk ${deadlineWeek}`
    }
    const task: Task = {
      id: newId,
      name: newTask.name || 'New Task',
      type: newTask.type,
      start: newTask.start,
      duration,
      progress: 0,
      // Baseline = [start, finish]. For Milestones (duration 0) this is
      // [start, start] so the outline doesn't show a misleading strikethrough
      // duration (audit R4-1 — previously used newTask.duration which was
      // the stale pre-switch value, e.g. 5, so a Milestone showed "0w ̶5w̶").
      baseline: [newTask.start, finishWeek],
      resources: [],
      critical: newTask.critical,
      constraints,
    }
    commitTasks((prev) => [...prev, task])
    setSelectedId(newId)
    setAddTaskOpen(false)
    setNewTask(EMPTY_NEW_TASK)
  }

  const toggleExpand = (id: string) => {
    setExpandedArr((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Search-filtered task tree — shared between the outline (renderTaskRows)
  // and the Gantt canvas so both views stay in sync when searching. Without
  // this, searching would filter the outline but leave the Gantt showing
  // all tasks, creating a confusing mismatch (audit R6-4). Memoized so the
  // filter only re-runs when tasksWithCpm or searchQuery change.
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tasksWithCpm
    const filterTree = (items: Task[]): Task[] => {
      const out: Task[] = []
      for (const t of items) {
        const childMatches = t.children ? filterTree(t.children) : []
        if (
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          childMatches.length > 0
        ) {
          out.push({ ...t, children: childMatches.length > 0 ? childMatches : t.children })
        }
      }
      return out
    }
    return filterTree(tasksWithCpm)
  }, [tasksWithCpm, searchQuery])

  // Flattened version of filteredTasks for the Gantt's arrow lookup and
  // the outline's footer stats.
  const filteredFlat = useMemo(() => flattenTasks(filteredTasks), [filteredTasks])

  const renderTaskRows = () => {
    const rows: React.ReactNode[] = []
    const walk = (items: Task[], depth: number) => {
      for (const t of items) {
        // "Critical path only" filter: skip non-critical LEAF tasks.
        // Summary tasks are always rendered (they provide structure) —
        // UNLESS they have no critical descendants, in which case they're
        // empty shells that just add noise. Skip them too (audit S7-5).
        const isLeaf = !t.children || t.children.length === 0
        if (showCriticalOnly && isLeaf && !t.critical) continue
        // For Summary tasks in critical-only mode, check if any descendant
        // is critical. If not, skip the Summary entirely — showing an empty
        // Summary with all children hidden is confusing.
        if (showCriticalOnly && !isLeaf && t.critical === false) {
          const hasCriticalDescendant = (nodes: Task[] | undefined): boolean =>
            nodes?.some((n) => n.critical || hasCriticalDescendant(n.children)) ?? false
          if (!hasCriticalDescendant(t.children)) continue
        }

        const isExpanded = expanded.has(t.id)
        const hasChildren = t.children && t.children.length > 0
        const isSelected = t.id === selectedId
        rows.push(
          <div
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={cn(
              'row-hover flex h-8 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
              isSelected && 'bg-accent',
              t.critical && 'bg-red-500/5'
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div className="w-6 flex-shrink-0">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(t.id)
                  }}
                  className="hover:bg-accent-foreground/10 rounded p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
            <div className="text-muted-foreground w-20 flex-shrink-0 font-mono">{t.id}</div>
            <div className="w-5 flex-shrink-0">
              {t.type === 'Milestone' && <Flag className="h-3.5 w-3.5 text-amber-500" />}
              {t.type === 'Hammock' && <Zap className="h-3.5 w-3.5 text-violet-500" />}
              {t.type === 'Summary' && <Layers className="text-muted-foreground h-3.5 w-3.5" />}
            </div>
            <div className={cn('min-w-0 flex-1 truncate', t.type === 'Summary' && 'font-semibold')}>
              {t.name}
            </div>
            <div className="w-16 flex-shrink-0 pr-2 text-right">
              {/* Duration is in WEEKS (matches types.ts `start: week offset`). */}
              <span className="font-mono tabular-nums">{t.duration}w</span>
              {t.baseline &&
                t.baseline[1] - t.baseline[0] !== t.duration &&
                t.type !== 'Summary' && (
                  <span className="text-muted-foreground ml-1 text-[9px] line-through">
                    {t.baseline[1] - t.baseline[0]}w
                  </span>
                )}
            </div>
            <div className="w-14 flex-shrink-0 pr-2 text-right font-mono">{t.progress}%</div>
          </div>
        )
        if (hasChildren && isExpanded) walk(t.children!, depth + 1)
      }
    }
    walk(filteredTasks, 0)
    return rows
  }

  // Gantt canvas — TODAY line is computed from the project epoch so it
  // advances as real time passes (was previously hardcoded to `16`).
  // Clamped to [0, TOTAL_WEEKS] so the red line doesn't render off-canvas
  // if the current date is far past the project end (audit R4-5 — previously
  // a date in 2027+ would place the TODAY line at week 52+, beyond the
  // canvas's 52-week width, making it invisible and confusing).
  const todayWeek = Math.max(
    0,
    Math.min(TOTAL_WEEKS, Math.floor((Date.now() - PROJECT_EPOCH.getTime()) / MS_PER_WEEK))
  )
  const canvasRef = useRef<HTMLDivElement>(null)

  // Mouse handlers for drag-to-move on Gantt bars. Wrapped in useCallback
  // (empty dep array — they only close over setState setters, which are
  // stable) so the memoized `TaskBar` children of the Gantt canvas don't
  // re-render on every parent render due to a new function identity.
  const onBarMouseDown = useCallback((e: React.MouseEvent, t: Task) => {
    if (t.type === 'Milestone' || t.type === 'Summary') return
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(t.id)
    setDragging({ id: t.id, startX: e.clientX, originalStart: t.start, mode: 'move' })
  }, [])

  // Mouse handler for resize (right-edge drag) on Gantt bars
  const onResizeMouseDown = useCallback((e: React.MouseEvent, t: Task) => {
    if (t.type === 'Milestone' || t.type === 'Summary') return
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(t.id)
    setDragging({ id: t.id, startX: e.clientX, originalDuration: t.duration, mode: 'resize' })
  }, [])

  // Keep a ref to the latest task tree so the drag-end breach detector
  // reads post-drag values instead of the stale closure value captured
  // when the `dragging` effect was set up.
  const tasksRef = useRef(taskTree)
  useEffect(() => {
    tasksRef.current = taskTree
  }, [taskTree])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragging.startX
      const deltaWeeks = Math.round(deltaPx / WEEK_WIDTH)
      if (dragging.mode === 'move') {
        updateTaskStart(dragging.id, dragging.originalStart + deltaWeeks)
      } else {
        updateTaskDuration(dragging.id, dragging.originalDuration + deltaWeeks)
      }
    }
    const onUp = () => {
      // Check for Critical Path Breach on drag end.
      // Read from tasksRef so we see the post-drag state, and search the
      // flattened tree recursively so Hammock tasks that are children of
      // Summary tasks (e.g. T-301 under T-300) are still found.
      const flat = flattenTasks(tasksRef.current)
      const updated = flat.find((f) => f.task.id === dragging?.id)?.task
      // Match both the human-readable and abbreviated forms of MFO and MSO
      // (C20 + S1 + R3-3). Seed T-404 uses "Must Finish On: Wk 48"; the
      // inspector constraint picker writes "MFO: Wk N" / "MSO: Wk N".
      // Both deadline constraint types should trigger the EOT breach
      // detector — previously only MFO was checked, so a task with
      // "MSO: Wk 20" whose start was week 25 was silently ignored (R3-3).
      const hasMFO =
        updated && updated.constraints && /^(MFO|Must Finish On)/i.test(updated.constraints)
      const hasMSO =
        updated && updated.constraints && /^(MSO|Must Start On)/i.test(updated.constraints)
      // Detect breach on ANY task type with MFO/MSO (audit S2 — previously
      // only Hammock tasks triggered the breach modal). Summary tasks are
      // still excluded because their start/finish are derived from
      // children, not directly editable by dragging.
      if (updated && (hasMFO || hasMSO) && updated.type !== 'Summary') {
        // Extract deadline from constraint string like "Must Finish On: Wk 32"
        // or "MFO: Wk 32". If the constraint is bare "MFO" with no week
        // (shouldn't happen post-fix since the inspector always writes
        // "MFO: Wk N", but be defensive), skip breach detection.
        const match = updated.constraints!.match(/Wk (\d+)/)
        if (match) {
          const deadlineWeek = parseInt(match[1])
          if (hasMFO) {
            // MFO: task must FINISH by deadlineWeek. Breach if finish > deadline.
            const finishWeek = updated.start + updated.duration
            if (finishWeek > deadlineWeek) {
              setBreachTask(updated)
              setBreachModal(true)
            }
          } else {
            // MSO: task must START by deadlineWeek. Breach if start > deadline.
            // (R3-3 — previously MSO was never checked.)
            if (updated.start > deadlineWeek) {
              setBreachTask(updated)
              setBreachModal(true)
            }
          }
        }
      }
      // Offer an undo for the drag. Compare the post-drag value with the
      // snapshot captured when the drag started (dragging.originalStart /
      // originalDuration) — only show the toast if the value actually
      // changed (avoids noise on click-without-drag).
      const dragInfo = dragging
      setDragging(null)
      if (!dragInfo || !updated) return
      if (dragInfo.mode === 'move' && updated.start !== dragInfo.originalStart) {
        const restoreId = dragInfo.id
        const restoreStart = dragInfo.originalStart
        undoableToast(
          'Task moved',
          `${updated.id} start changed (wk ${dragInfo.originalStart} → ${updated.start}). Click Undo to restore.`,
          () => updateTaskStart(restoreId, restoreStart)
        )
      } else if (dragInfo.mode === 'resize' && updated.duration !== dragInfo.originalDuration) {
        const restoreId = dragInfo.id
        const restoreDuration = dragInfo.originalDuration
        undoableToast(
          'Task resized',
          `${updated.id} duration changed (${dragInfo.originalDuration}w → ${updated.duration}w). Click Undo to restore.`,
          () => updateTaskDuration(restoreId, restoreDuration)
        )
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  if (tasksLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading tasks…" />
      </div>
    )
  }

  // Guard against an empty task tree (e.g. fresh install with no seed data,
  // or all tasks deleted). Without this, `selectedTask` is null and the
  // TaskInspector below would crash dereferencing it. Placed AFTER all hooks
  // have been called so we don't violate rules-of-hooks.
  if (!selectedTask) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="No tasks yet — add one to get started." />
      </div>
    )
  }

  return (
    <>
      <Workspace3Pane
        leftPane={
          <>
            <PaneHeader title="Task Outline">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setAddTaskOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <div className="space-y-2 border-b border-[var(--pane-divider)] px-3 py-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Filter tasks…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={showCriticalOnly} onCheckedChange={setShowCriticalOnly} />
                <span>Critical path only</span>
              </label>
            </div>
            <PaneBody className="py-2">{renderTaskRows()}</PaneBody>
            <div className="space-y-1 border-t border-[var(--pane-divider)] p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total tasks</span>
                <span className="font-mono">{flat.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Critical path</span>
                <span className="font-mono text-red-500">
                  {flat.filter((f) => f.task.critical && f.task.type === 'Work').length} tasks ·{' '}
                  {flat
                    .filter((f) => f.task.critical && f.task.type === 'Work')
                    .reduce((s, f) => s + f.task.duration, 0)}
                  w
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project finish</span>
                <span className="font-mono">Wk {projectFinishWeek}</span>
              </div>
            </div>
          </>
        }
        centerPane={
          <>
            <PaneHeader title="Gantt Canvas · W1 to W52">
              <span className="text-muted-foreground bg-secondary/60 hidden items-center gap-1.5 rounded px-2 py-0.5 text-[10px] md:flex">
                <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                Drag bars to move · drag edges to resize
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={showResources} onCheckedChange={setShowResources} />
                <span className="text-muted-foreground">Resource usage</span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  // Use the CPM-annotated task tree (not the raw seed/persisted
                  // tree) so leveling's heuristics read the computed
                  // `critical` flags rather than the seed-decorated ones
                  // (C13). Without this, leveling would treat seed-marked
                  // tasks as critical even after CPM recomputed their float.
                  const result = levelResources(tasksWithCpm)
                  if (result.shifts.length === 0) {
                    toast.success('Resources already level', {
                      description: `Peak load: ${result.peakLoadBefore} resource units/week`,
                    })
                    // Still surface any pre-existing dependency violations
                    // even when no shifts were made (audit S10).
                    if (result.violations.length > 0) {
                      toast.warning(
                        `${result.violations.length} pre-existing FS violation${result.violations.length === 1 ? '' : 's'}`,
                        {
                          description: result.violations
                            .slice(0, 3)
                            .map(
                              (v) =>
                                `${v.id} starts wk ${v.taskStart} but ${v.predecessorId} finishes wk ${v.predecessorFinish}`
                            )
                            .join(' · '),
                        }
                      )
                    }
                    return
                  }
                  // Snapshot the flat rows BEFORE applying leveling so the
                  // undoableToast can restore them. `tasks` is the flat list
                  // (DB shape), so restoring it directly is correct.
                  const prevTasks = tasks
                  commitTasks(() => result.leveledTasks)
                  toast.success('Resources leveled', {
                    description: `${result.shifts.length} task${result.shifts.length === 1 ? '' : 's'} shifted · peak ${result.peakLoadBefore} → ${result.peakLoadAfter}`,
                  })
                  // Surface any pre-existing FS dependency violations that
                  // leveling couldn't fix (e.g. a task that already started
                  // before its predecessor finished — we don't move it
                  // further into violation, but the user should know).
                  // (audit S10)
                  if (result.violations.length > 0) {
                    toast.warning(
                      `${result.violations.length} FS dependency violation${result.violations.length === 1 ? '' : 's'} detected`,
                      {
                        description: result.violations
                          .slice(0, 3)
                          .map(
                            (v) =>
                              `${v.id} starts wk ${v.taskStart} but predecessor ${v.predecessorId} finishes wk ${v.predecessorFinish}`
                          )
                          .join(' · '),
                      }
                    )
                  }
                  undoableToast(
                    'Resource leveling applied',
                    `${result.shifts.length} tasks shifted to smooth peak resource load.`,
                    () => {
                      setTasks(prevTasks)
                    }
                  )
                }}
              >
                <Gauge className="h-3.5 w-3.5" />
                Level
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setAddTaskOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Task
              </Button>
            </PaneHeader>
            <GanttCanvas
              tasks={filteredTasks}
              flatTasks={filteredFlat}
              expanded={expanded}
              selectedId={selectedId}
              onSelect={setSelectedId}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              dragging={dragging}
              onToggleExpand={toggleExpand}
              onBarMouseDown={onBarMouseDown}
              onResizeMouseDown={onResizeMouseDown}
              showResources={showResources}
              todayWeek={todayWeek}
              canvasRef={canvasRef}
            />
          </>
        }
        rightPane={
          <TaskInspector
            key={selectedTask.id}
            task={selectedTask}
            onUpdateDuration={updateTaskDuration}
            onUpdateProgress={updateTaskProgress}
            onUpdateLocation={(locId) => {
              // Propagate the location link into the synced tasks store so
              // it persists to Supabase (location_id column added in
              // migration 12) and is visible to other modules. Without this
              // the inspector only kept the link in local state. The task
              // tree is mutated via produce so nested children are updated
              // immutably too.
              //
              // Uses commitTasks (not setTasks directly) so the tree is
              // flattened before persisting — otherwise children would be
              // dropped by useSyncedState's top-level-only upsert.
              commitTasks((prev) =>
                produce(prev, (draft) => {
                  const walk = (items: Task[]) => {
                    for (const t of items) {
                      if (t.id === selectedTask.id) {
                        t.locationId = locId ?? undefined
                      }
                      if (t.children) walk(t.children)
                    }
                  }
                  walk(draft)
                })
              )
            }}
            onUpdateConstraint={(constraint) =>
              // Propagate the picked constraint code (ASAP/ALAP/SNET/FNLT/MFO/MSO)
              // into the synced tasks store so it persists to Supabase and is
              // visible to the EOT breach detector (which checks the
              // `constraints` string for `Must Finish On` / `MFO`). Walks the
              // tree so nested children are updated immutably (matches the
              // locationId update path).
              commitTasks((prev) =>
                produce(prev, (draft) => {
                  const walk = (items: Task[]) => {
                    for (const t of items) {
                      if (t.id === selectedTask.id) t.constraints = constraint
                      if (t.children) walk(t.children)
                    }
                  }
                  walk(draft as Task[])
                })
              )
            }
          />
        }
        leftPaneWidth="320px"
        rightPaneWidth="380px"
      />

      {/* Add Task Modal */}
      {addTaskOpen && (
        <AddTaskModal
          newTask={newTask}
          setNewTask={setNewTask}
          onClose={() => setAddTaskOpen(false)}
          onSubmit={addTask}
        />
      )}

      {/* Critical Path Breach / EOT Modal */}
      {breachModal && breachTask && (
        <CriticalPathBreachModal
          task={breachTask}
          onClose={() => {
            setBreachModal(false)
            setBreachTask(null)
          }}
          // EOT Claim and Accelerate callbacks are omitted — the modal falls
          // back to informative toasts ("coming soon — use Correspondence
          // module / contact planning team") until the underlying features
          // are wired up.
        />
      )}
    </>
  )
}

// Re-export as both named and default
export default SchedulerModule
