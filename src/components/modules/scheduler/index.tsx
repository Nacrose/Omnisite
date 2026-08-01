'use client'

import { useState, useRef, useEffect } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Search, Plus, Gauge, ChevronRight, ChevronDown, Flag, Layers, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { undoableToast } from '@/components/ui/confirm-dialog'
import {
  TASKS, TOTAL_WEEKS, WEEK_WIDTH, flattenTasks,
  type Task, type DragState,
} from './types'
import { GanttCanvas } from './gantt-canvas'
import { TaskInspector } from './task-inspector'
import { AddTaskModal, CriticalPathBreachModal, EMPTY_NEW_TASK, type NewTaskDraft } from './modals'
import { calculateCpm, type CpmTask } from '@/lib/cpm'
import { useMemo } from 'react'

export function SchedulerModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
  const [selectedId, setSelectedId] = usePersistentState('omnisite-scheduler-selected', 'T-203')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>('omnisite-scheduler-expanded', ['T-100', 'T-200', 'T-300', 'T-400'])
  const [tasks, setTasks, tasksLoading] = useSyncedState<Task[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => JSON.parse(JSON.stringify(TASKS)),
    {
      fieldMap: {
        start: 'start_week',
        duration: 'duration',
        baseline: 'baseline_finish',
        constraints: 'constraints',
        parentId: 'parent_id',
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
  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)

  // Real CPM calculation — compute critical path from task dependencies
  const cpmResult = useMemo(() => {
    const flat = flattenTasks(tasks)
    // Build CPM input from flat task list
    const cpmTasks: CpmTask[] = flat.map(({ task }) => ({
      id: task.id,
      duration: task.duration,
      predecessors: [], // No explicit dependency links in current data model
    }))
    try {
      const result = calculateCpm(cpmTasks)
      return result
    } catch {
      return null
    }
  }, [tasks])

  // Apply CPM critical path to tasks (override the decorative boolean)
  const tasksWithCpm = useMemo(() => {
    if (!cpmResult) return tasks
    const updateTasks = (items: Task[]): Task[] => {
      return items.map(t => {
        const cpmData = cpmResult.results[t.id]
        const isCritical = cpmData ? cpmData.isCritical : t.critical
        const updated = { ...t, critical: isCritical }
        if (t.children) {
          updated.children = updateTasks(t.children)
        }
        return updated
      })
    }
    return updateTasks(tasks)
  }, [tasks, cpmResult])
  // Add Task modal state
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState<NewTaskDraft>(EMPTY_NEW_TASK)

  const flat = flattenTasks(tasksWithCpm)
  // Apply the "Critical path only" filter so the toggle actually does something.
  // Previously `visible` was declared but never used, and the filter body returned
  // true on every branch.
  const visible = flat.filter(({ task }) =>
    !showCriticalOnly || task.critical || task.type === 'Summary',
  )
  const selectedTask = flat.find(f => f.task.id === selectedId)?.task ?? flat[0].task

  // Update a task's start date when dragged
  const updateTaskStart = (id: string, newStart: number) => {
    setTasks(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as Task[]
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
      walk(updated)
      return updated
    })
  }

  // Update a task's duration when resized
  const updateTaskDuration = (id: string, newDuration: number) => {
    setTasks(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as Task[]
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
      walk(updated)
      return updated
    })
  }

  // Add a new task to the top level
  const addTask = () => {
    const taskNum = flat.length + 1
    const newId = `T-${500 + taskNum}`
    const task: Task = {
      id: newId,
      name: newTask.name || 'New Task',
      type: newTask.type,
      start: newTask.start,
      duration: newTask.type === 'Milestone' ? 0 : newTask.duration,
      progress: 0,
      baseline: [newTask.start, newTask.start + newTask.duration],
      resources: [],
      critical: newTask.critical,
      constraints: newTask.constraints,
    }
    setTasks(prev => [...prev, task])
    setSelectedId(newId)
    setAddTaskOpen(false)
    setNewTask(EMPTY_NEW_TASK)
  }

  const toggleExpand = (id: string) => {
    setExpandedArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const renderTaskRows = () => {
    const rows: React.ReactNode[] = []
    // When showCriticalOnly is on, render only the filtered visible list.
    // When searchQuery is non-empty, filter the tree by id/name (keeping ancestors).
    // Otherwise render the full tree.
    const q = searchQuery.trim().toLowerCase()
    const filterTree = (items: Task[]): Task[] => {
      if (!q) return items
      const out: Task[] = []
      for (const t of items) {
        const childMatches = t.children ? filterTree(t.children) : []
        if (t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || childMatches.length > 0) {
          out.push({ ...t, children: childMatches.length > 0 ? childMatches : t.children })
        }
      }
      return out
    }
    const baseItems = showCriticalOnly ? visible.map(v => v.task) : tasksWithCpm
    const itemsToRender = filterTree(baseItems)
    const walk = (items: Task[], depth: number) => {
      for (const t of items) {
        const isExpanded = expanded.has(t.id)
        const hasChildren = t.children && t.children.length > 0
        const isSelected = t.id === selectedId
        rows.push(
          <div
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={cn(
              'flex items-center h-8 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover transition-colors',
              isSelected && 'bg-accent',
              t.critical && 'bg-red-500/5'
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div className="w-6 flex-shrink-0">
              {hasChildren && (
                <button onClick={e => { e.stopPropagation(); toggleExpand(t.id) }} className="p-0.5 hover:bg-accent-foreground/10 rounded">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="w-20 flex-shrink-0 font-mono text-muted-foreground">{t.id}</div>
            <div className="w-5 flex-shrink-0">
              {t.type === 'Milestone' && <Flag className="w-3.5 h-3.5 text-amber-500" />}
              {t.type === 'Hammock' && <Zap className="w-3.5 h-3.5 text-violet-500" />}
              {t.type === 'Summary' && <Layers className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <div className={cn('flex-1 min-w-0 truncate', t.type === 'Summary' && 'font-semibold')}>{t.name}</div>
            <div className="w-16 flex-shrink-0 text-right pr-2">
              {/* Duration is in WEEKS (matches types.ts `start: week offset`). */}
              <span className="font-mono tabular-nums">{t.duration}w</span>
              {t.baseline && t.baseline[1] - t.baseline[0] !== t.duration && t.type !== 'Summary' && (
                <span className="text-[9px] text-muted-foreground line-through ml-1">
                  {t.baseline[1] - t.baseline[0]}w
                </span>
              )}
            </div>
            <div className="w-14 flex-shrink-0 text-right pr-2 font-mono">{t.progress}%</div>
          </div>
        )
        if (hasChildren && isExpanded) walk(t.children!, depth + 1)
      }
    }
    walk(itemsToRender, 0)
    return rows
  }

  // Gantt canvas
  const todayWeek = 16
  const canvasRef = useRef<HTMLDivElement>(null)

  // Mouse handlers for drag-to-move on Gantt bars
  const onBarMouseDown = (e: React.MouseEvent, t: Task) => {
    if (t.type === 'Milestone' || t.type === 'Summary') return
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(t.id)
    setDragging({ id: t.id, startX: e.clientX, originalStart: t.start, mode: 'move' })
  }

  // Mouse handler for resize (right-edge drag) on Gantt bars
  const onResizeMouseDown = (e: React.MouseEvent, t: Task) => {
    if (t.type === 'Milestone' || t.type === 'Summary') return
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(t.id)
    setDragging({ id: t.id, startX: e.clientX, originalDuration: t.duration, mode: 'resize' })
  }

  // Keep a ref to the latest tasks so the drag-end breach detector reads
  // post-drag values instead of the stale closure value captured when the
  // `dragging` effect was set up.
  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks }, [tasks])

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
      const updated = flat.find(f => f.task.id === dragging?.id)?.task
      if (updated && updated.type === 'Hammock' && updated.constraints?.includes('Must Finish On')) {
        // Extract deadline from constraint string like "Must Finish On: Wk 32"
        const match = updated.constraints.match(/Wk (\d+)/)
        if (match) {
          const deadlineWeek = parseInt(match[1])
          const finishWeek = updated.start + updated.duration
          if (finishWeek > deadlineWeek) {
            setBreachTask(updated)
            setBreachModal(true)
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
          () => updateTaskStart(restoreId, restoreStart),
        )
      } else if (dragInfo.mode === 'resize' && updated.duration !== dragInfo.originalDuration) {
        const restoreId = dragInfo.id
        const restoreDuration = dragInfo.originalDuration
        undoableToast(
          'Task resized',
          `${updated.id} duration changed (${dragInfo.originalDuration}w → ${updated.duration}w). Click Undo to restore.`,
          () => updateTaskDuration(restoreId, restoreDuration),
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
    return <div className="h-full flex items-center justify-center"><LoadingState label="Loading tasks…" /></div>
  }

  return (
    <>
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Task Outline">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setAddTaskOpen(true)}><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)] space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter tasks…" className="h-8 pl-7 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showCriticalOnly} onCheckedChange={setShowCriticalOnly} />
              <span>Critical path only</span>
            </label>
          </div>
          <PaneBody className="py-2">{renderTaskRows()}</PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total tasks</span><span className="font-mono">{flat.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Critical path</span><span className="font-mono text-red-500">{flat.filter(f => f.task.critical && f.task.type === 'Work').length} tasks · {flat.filter(f => f.task.critical && f.task.type === 'Work').reduce((s, f) => s + f.task.duration, 0)}w</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Project finish</span><span className="font-mono">Wk 48</span></div>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="Gantt Canvas · W1 to W52">
            <span className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-secondary/60">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Drag bars to move · drag edges to resize
            </span>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={showResources} onCheckedChange={setShowResources} />
              <span className="text-muted-foreground">Resource usage</span>
            </label>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Gauge className="w-3.5 h-3.5" />Level</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAddTaskOpen(true)}><Plus className="w-3.5 h-3.5" />Task</Button>
          </PaneHeader>
          <GanttCanvas
            tasks={tasksWithCpm}
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
      rightPane={<TaskInspector task={selectedTask} />}
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
          onClose={() => { setBreachModal(false); setBreachTask(null) }}
          onEotClaim={() => {
            toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })
            setBreachModal(false); setBreachTask(null)
          }}
          onAccelerate={() => {
            toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })
            setBreachModal(false); setBreachTask(null)
          }}
        />
      )}
    </>
  )
}

// Re-export as both named and default
export default SchedulerModule

