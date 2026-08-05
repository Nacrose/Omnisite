'use client'

import { useCallback, useEffect } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import { undoableToast } from '@/components/ui/confirm-dialog'
import { flattenTasks, WEEK_WIDTH, type Task } from './types'
import { EMPTY_NEW_TASK, type NewTaskDraft } from './modals'
import type { useSchedulerState } from './use-scheduler-state'

type SchedulerState = ReturnType<typeof useSchedulerState>

/**
 * Mutation handlers + drag effect + breach detection for the Scheduler.
 *
 * Extracted from `SchedulerModule` so the component body focuses on render.
 * Each handler calls `state.commitTasks` (which flattens the tree before
 * persisting — see use-scheduler-state.ts).
 */
export function useSchedulerHandlers(state: SchedulerState) {
  const {
    commitTasks,
    effectiveWeeks,
    setDragging,
    setSelectedId,
    setBreachTask,
    setBreachModal,
    setAddTaskOpen,
    setNewTask,
    setExpandedArr,
    dragging,
    tasksRef,
  } = state

  // ─── Task mutation handlers ────────────────────────────────────────────

  /** Update a task's start week when dragged. Clamps to [0, effectiveWeeks - duration]. */
  const updateTaskStart = useCallback(
    (id: string, newStart: number) => {
      commitTasks((prev) =>
        produce(prev, (draft) => {
          const walk = (items: Task[]): boolean => {
            for (const t of items) {
              if (t.id === id) {
                t.start = Math.max(0, Math.min(effectiveWeeks - t.duration, newStart))
                return true
              }
              if (t.children && walk(t.children)) return true
            }
            return false
          }
          walk(draft as Task[])
        })
      )
    },
    [commitTasks, effectiveWeeks]
  )

  /** Update a task's duration when resized. Clamps to [1, effectiveWeeks - start]. */
  const updateTaskDuration = useCallback(
    (id: string, newDuration: number) => {
      commitTasks((prev) =>
        produce(prev, (draft) => {
          const walk = (items: Task[]): boolean => {
            for (const t of items) {
              if (t.id === id) {
                t.duration = Math.max(1, Math.min(effectiveWeeks - t.start, newDuration))
                return true
              }
              if (t.children && walk(t.children)) return true
            }
            return false
          }
          walk(draft as Task[])
        })
      )
    },
    [commitTasks, effectiveWeeks]
  )

  /** Update a task's progress from the inspector input. Clamps to [0, 100]. */
  const updateTaskProgress = useCallback(
    (id: string, newProgress: number) => {
      commitTasks((prev) =>
        produce(prev, (draft) => {
          const walk = (items: Task[]): boolean => {
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
    },
    [commitTasks]
  )

  /** Update a task's location link (persisted to location_id column). */
  const updateTaskLocation = useCallback(
    (taskId: string, locId: string | null) => {
      commitTasks((prev) =>
        produce(prev, (draft) => {
          const walk = (items: Task[]) => {
            for (const t of items) {
              if (t.id === taskId) {
                t.locationId = locId ?? undefined
              }
              if (t.children) walk(t.children)
            }
          }
          walk(draft)
        })
      )
    },
    [commitTasks]
  )

  /** Update a task's constraint code (ASAP/ALAP/SNET/FNLT/MFO/MSO). */
  const updateTaskConstraint = useCallback(
    (taskId: string, constraint: string) => {
      commitTasks((prev) =>
        produce(prev, (draft) => {
          const walk = (items: Task[]) => {
            for (const t of items) {
              if (t.id === taskId) t.constraints = constraint
              if (t.children) walk(t.children)
            }
          }
          walk(draft as Task[])
        })
      )
    },
    [commitTasks]
  )

  // ─── Breach detection ──────────────────────────────────────────────────
  // Extracted into a reusable function so it can be called from both the
  // drag-end handler AND the inspector's constraint-update callback.
  // Previously the breach check lived ONLY inside the drag-end onUp handler,
  // so setting "MFO: Wk 10" via the inspector on a task already finishing
  // at week 20 would never trigger the modal.

  /**
   * Check a task for an MFO/MSO deadline breach and open the breach modal
   * if the task's start/finish exceeds the deadline week.
   */
  const checkBreach = useCallback(
    (task: Task | undefined) => {
      if (!task || !task.constraints || task.type === 'Summary') return
      const hasMFO = /^(MFO|Must Finish On)/i.test(task.constraints)
      const hasMSO = /^(MSO|Must Start On)/i.test(task.constraints)
      if (!hasMFO && !hasMSO) return
      const match = task.constraints.match(/Wk (\d+)/)
      if (!match) return
      const deadlineWeek = parseInt(match[1])
      if (hasMFO) {
        const finishWeek = task.start + task.duration
        if (finishWeek > deadlineWeek) {
          setBreachTask(task)
          setBreachModal(true)
        }
      } else {
        if (task.start > deadlineWeek) {
          setBreachTask(task)
          setBreachModal(true)
        }
      }
    },
    [setBreachTask, setBreachModal]
  )

  // ─── Add task ──────────────────────────────────────────────────────────

  const addTask = useCallback(
    (newTask: NewTaskDraft) => {
      // Time-based ID so concurrent adds don't collide. Previously
      // `T-${500 + taskNum}` would clash with seed task IDs once the count
      // grew past 100, and would duplicate IDs if tasks were deleted and
      // re-added.
      const newId = `T-${crypto.randomUUID()}`
      const isMilestone = newTask.type === 'Milestone'
      const isSummary = newTask.type === 'Summary'
      // Milestones have duration 0. Summary tasks start with duration 0 —
      // it's derived from children once children are added.
      const duration = isMilestone || isSummary ? 0 : newTask.duration
      const finishWeek = newTask.start + duration
      // Build the constraint string. For MFO/MSO, auto-default to the task's
      // finish/start week so the breach detector has a week to compare
      // against (audit R3-5 — previously the modal wrote a bare 'MFO' with
      // no week, so breach detection never fired until the user opened the
      // inspector and set a week manually).
      let constraints = newTask.constraints
      if (constraints === 'MFO' || constraints === 'MSO') {
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
        // [start, start] so the outline doesn't show a misleading
        // strikethrough duration (audit R4-1).
        baseline: [newTask.start, finishWeek],
        resources: [],
        critical: newTask.critical,
        constraints,
      }
      commitTasks((prev) => [...prev, task])
      setSelectedId(newId)
      setAddTaskOpen(false)
      setNewTask(EMPTY_NEW_TASK)
    },
    [commitTasks, setSelectedId, setAddTaskOpen, setNewTask]
  )

  // ─── Expand/collapse ───────────────────────────────────────────────────

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedArr((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    },
    [setExpandedArr]
  )

  // ─── Gantt mouse handlers ──────────────────────────────────────────────
  // Wrapped in useCallback so the memoized `TaskBar` children of the Gantt
  // canvas don't re-render on every parent render due to a new function
  // identity.

  const onBarMouseDown = useCallback(
    (e: React.MouseEvent, t: Task) => {
      if (t.type === 'Milestone' || t.type === 'Summary') return
      e.stopPropagation()
      e.preventDefault()
      setSelectedId(t.id)
      setDragging({ id: t.id, startX: e.clientX, originalStart: t.start, mode: 'move' })
    },
    [setSelectedId, setDragging]
  )

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, t: Task) => {
      if (t.type === 'Milestone' || t.type === 'Summary') return
      e.stopPropagation()
      e.preventDefault()
      setSelectedId(t.id)
      setDragging({ id: t.id, startX: e.clientX, originalDuration: t.duration, mode: 'resize' })
    },
    [setSelectedId, setDragging]
  )

  // ─── Drag effect ───────────────────────────────────────────────────────
  // Listens to mousemove/mouseup on window while `dragging` is active.
  // On drag end: checks for a critical-path breach (MFO/MSO deadline) and
  // offers an undoable toast if the value actually changed.

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
      // Check for Critical Path Breach on drag end. Read from tasksRef so we
      // see the post-drag state, and search the flattened tree recursively so
      // Hammock tasks that are children of Summary tasks (e.g. T-301 under
      // T-300) are still found.
      const flat = flattenTasks(tasksRef.current)
      const updated = flat.find((f) => f.task.id === dragging?.id)?.task
      // Use the shared breach-detection function (also called from the
      // inspector's constraint-update callback — previously this logic was
      // duplicated inline here only, leaving inspector-set deadlines
      // uncovered).
      checkBreach(updated)
      // Offer an undo for the drag. Compare the post-drag value with the
      // snapshot captured when the drag started — only show the toast if the
      // value actually changed (avoids noise on click-without-drag).
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
  }, [dragging, updateTaskStart, updateTaskDuration, checkBreach, setDragging, tasksRef])

  // ─── Resource leveling ─────────────────────────────────────────────────
  // Extracted from the inline onClick so the JSX stays readable. Uses the
  // CPM-annotated task tree (not the raw seed/persisted tree) so leveling's
  // heuristics read the computed `critical` flags rather than the
  // seed-decorated ones (C13).

  const levelResourcesNow = useCallback(async () => {
    const { levelResources } = await import('./leveling')
    const { tasksWithCpm, setTasks, tasks } = state
    const result = levelResources(tasksWithCpm)
    if (result.shifts.length === 0) {
      toast.success('Resources already level', {
        description: `Peak load: ${result.peakLoadBefore} resource units/week`,
      })
      // Still surface any pre-existing dependency violations even when no
      // shifts were made (audit S10).
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
    // Snapshot the flat rows BEFORE applying leveling so the undoableToast
    // can restore them. `tasks` is the flat list (DB shape).
    const prevTasks = tasks
    commitTasks(() => result.leveledTasks)
    toast.success('Resources leveled', {
      description: `${result.shifts.length} task${result.shifts.length === 1 ? '' : 's'} shifted · peak ${result.peakLoadBefore} → ${result.peakLoadAfter}`,
    })
    // Surface any pre-existing FS dependency violations that leveling
    // couldn't fix (audit S10).
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
  }, [state, commitTasks])

  return {
    updateTaskStart,
    updateTaskDuration,
    updateTaskProgress,
    updateTaskLocation,
    updateTaskConstraint,
    checkBreach,
    addTask,
    toggleExpand,
    onBarMouseDown,
    onResizeMouseDown,
    levelResourcesNow,
  }
}
