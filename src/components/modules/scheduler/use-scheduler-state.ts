'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { produce } from 'immer'
import { flattenTree, rebuildTreeFromRows } from '@/lib/tree-utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { getTodayWeek } from '@/lib/project-constants'
import { useApp } from '@/lib/app-store'
import { PROJECTS } from '@/components/project-switcher'
import { calculateCpm, type CpmTask } from '@/lib/cpm'
import { TASKS, flattenTasks, computeProjectWeeks, type Task, type DragState } from './types'
import { EMPTY_NEW_TASK, type NewTaskDraft } from './modals'

/**
 * Flatten a Task tree for DB storage. Strips `children` and sets `parentId`
 * on each row. Mirrors the BOQ module's `flattenBoqTree` — the scheduler
 * persists flat rows to the `tasks` table (with `parent_id` FK) and rebuilds
 * the tree on load, so child tasks round-trip through Supabase instead of
 * being silently dropped by useSyncedState's top-level-only upsert.
 */
export function flattenTaskTree(items: Task[], parentId: string | null = null): Task[] {
  return flattenTree(items as unknown as Record<string, unknown>[], parentId) as unknown as Task[]
}

/**
 * Resolve the active project's start date for the "today" line. Falls back
 * to `DEFAULT_PROJECT_EPOCH` (inside `getTodayWeek`) when the active project
 * isn't in the static `PROJECTS` array — e.g. when Supabase returns a project
 * that wasn't seeded client-side.
 */
export function useProjectEpoch(): Date | undefined {
  const { activeProjectId } = useApp()
  return PROJECTS.find((p) => p.id === activeProjectId)?.startDate
}

/**
 * State + derived memoizations + commit logic for the Scheduler module.
 *
 * Extracted from `SchedulerModule` so the component body focuses on render.
 * This hook owns:
 *   - Synced task state (Supabase or localStorage)
 *   - UI state (selection, expansion, search, drag, modals)
 *   - CPM critical-path computation
 *   - The `commitTasks` updater (flattens tree → setTasks so children persist)
 *   - Derived: taskTree, flat, selectedTask, effectiveWeeks, todayWeek,
 *     projectFinishWeek, filteredTasks, filteredFlat
 *
 * Mutation handlers (updateTaskStart, addTask, etc.) live in
 * `useSchedulerHandlers` — they depend on the `commitTasks` returned here.
 */
export function useSchedulerState() {
  // ─── Synced state ──────────────────────────────────────────────────────
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
      // Scheduler needs the full task tree in memory for CPM critical-path
      // computation and resource leveling (which traverse the whole graph).
      // Default cap of 3 pages (600 rows) is too low for large projects.
      maxPages: 10,
    }
  )

  // ─── Non-persistent UI state ───────────────────────────────────────────
  const [showResources, setShowResources] = useState(false)
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [dragging, setDragging] = useState<DragState>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [breachModal, setBreachModal] = useState(false)
  const [breachTask, setBreachTask] = useState<Task | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState<NewTaskDraft>(EMPTY_NEW_TASK)

  // Convert expanded array to Set for O(1) lookups. Memoized so the Set
  // instance is stable across renders when `expandedArr` hasn't changed.
  const expanded = useMemo(() => new Set(expandedArr), [expandedArr])

  // ─── Tree rebuild ──────────────────────────────────────────────────────
  // `useSyncedState` stores flat rows (one row per task, parent_id FK) and
  // only upserts top-level items in the array. Without this rebuild, every
  // reload would lose the parent/child nesting. Mirrors the BOQ module's
  // `rebuildBoqTree(boqRows)`.
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
   * so child rows are persisted to the DB. Mirrors the BOQ module's
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

  // ─── CPM critical path ─────────────────────────────────────────────────
  // Summary tasks are excluded from CPM input: they're roll-ups (their
  // start/finish are derived from children, not scheduled). Including them
  // would inject phantom predecessors and corrupt the critical path (C9).
  // Hammock tasks ARE included (audit R5-3 — previously excluded, which
  // meant any task with an SS/FS dep on a Hammock lost its predecessor).
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
      return calculateCpm(cpmTasks)
    } catch (err) {
      // CPM threw — most likely a dependency cycle. Surface the error via
      // console.warn and fall back to the seed-decorated critical flags so
      // the UI doesn't crash. The fallback isn't correct (the seed flags
      // may be stale), but it's better than rendering nothing (audit S5).
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

  // ─── Derived: flat, selectedTask, weeks, filtered ──────────────────────
  const flat = useMemo(() => flattenTasks(tasksWithCpm), [tasksWithCpm])
  const selectedTask = flat.find((f) => f.task.id === selectedId)?.task ?? flat[0]?.task ?? null

  // If selectedId points to a task that no longer exists, sync selectedId to
  // the fallback so the outline highlights the right row (audit R6-6). Uses
  // the "adjust state during render" pattern to avoid the lint violation
  // that useEffect+setState would trigger.
  if (selectedTask && selectedTask.id !== selectedId) {
    setSelectedId(selectedTask.id)
  }

  // Project finish — the latest end-week (start + duration) across all LEAF
  // tasks. Previously this used all tasks including Summary, whose duration
  // can be stale (not yet recomputed from children), inflating the reported
  // finish week. Leaf tasks (Work, Milestone, Hammock) have authoritative
  // durations (audit R6-9).
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

  // Effective project weeks — dynamically computed from the task tree so
  // projects longer than 52 weeks aren't truncated. The Gantt canvas, drag
  // clamps, inspector inputs, and modal inputs all use this value instead
  // of the hardcoded TOTAL_WEEKS=52.
  const effectiveWeeks = useMemo(() => computeProjectWeeks(taskTree), [taskTree])

  // Gantt canvas — TODAY line is computed from the active project's start
  // date so it advances as real time passes (was previously hardcoded to
  // `16`, then to a fixed 2026-04-01 epoch that was wrong for any project
  // that didn't start on that date). Clamped to [0, effectiveWeeks] via the
  // shared helper (audit R4-5).
  const projectEpoch = useProjectEpoch()
  const todayWeek = getTodayWeek(effectiveWeeks, projectEpoch)

  // Search-filtered task tree — shared between the outline and the Gantt
  // canvas so both views stay in sync when searching. Without this, searching
  // would filter the outline but leave the Gantt showing all tasks (audit R6-4).
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

  // Flattened version of filteredTasks for the Gantt's arrow lookup and the
  // outline's footer stats.
  const filteredFlat = useMemo(() => flattenTasks(filteredTasks), [filteredTasks])

  // Keep a ref to the latest task tree so the drag-end breach detector reads
  // post-drag values instead of the stale closure value captured when the
  // `dragging` effect was set up.
  const tasksRef = useRef(taskTree)
  useEffect(() => {
    tasksRef.current = taskTree
  }, [taskTree])

  return {
    // Synced state
    tasks,
    setTasks,
    tasksLoading,
    taskTree,
    tasksWithCpm,
    tasksRef,
    commitTasks,
    // UI state
    selectedId,
    setSelectedId,
    expandedArr,
    setExpandedArr,
    expanded,
    showResources,
    setShowResources,
    showCriticalOnly,
    setShowCriticalOnly,
    dragging,
    setDragging,
    hoveredId,
    setHoveredId,
    searchQuery,
    setSearchQuery,
    breachModal,
    setBreachModal,
    breachTask,
    setBreachTask,
    addTaskOpen,
    setAddTaskOpen,
    newTask,
    setNewTask,
    // Derived
    flat,
    selectedTask,
    projectFinishWeek,
    effectiveWeeks,
    todayWeek,
    filteredTasks,
    filteredFlat,
    cpmResult,
  }
}
