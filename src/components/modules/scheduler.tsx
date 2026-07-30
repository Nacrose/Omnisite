'use client'

import { useState, useRef, useEffect } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Search, Plus, ChevronRight, ChevronDown, Flag, Link2, AlertTriangle,
  Calendar, Clock, Users, Layers, Zap, Gauge, TrendingUp, TrendingDown,
  Package, Activity, Milestone, X, ArrowRight, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CollaboratorCursors } from '@/components/collaborator-cursors'
import { usePersistentState } from '@/lib/use-persistent-state'
import { toast } from 'sonner'

interface Task {
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
}

const TASKS: Task[] = [
  {
    id: 'T-100', name: 'Site Mobilization', type: 'Summary', start: 0, duration: 6, progress: 100, baseline: [0, 6], resources: [],
    children: [
      { id: 'T-101', name: 'Setup site office & storage', type: 'Work', start: 0, duration: 3, progress: 100, baseline: [0, 3], resources: ['M-1'], constraints: 'ASAP' },
      { id: 'T-102', name: 'Plant & machinery deployment', type: 'Work', start: 2, duration: 4, progress: 100, baseline: [2, 6], resources: ['E-1', 'E-2'] },
      { id: 'T-103', name: 'Mobilization milestone', type: 'Milestone', start: 6, duration: 0, progress: 100, baseline: [6, 6], resources: [], constraints: 'FNLT' },
    ],
  },
  {
    id: 'T-200', name: 'Foundation Works', type: 'Summary', start: 5, duration: 14, progress: 72, baseline: [4, 18], resources: [],
    children: [
      { id: 'T-201', name: 'Excavation ch. 0+000 to 1+200', type: 'Work', start: 5, duration: 5, progress: 100, baseline: [4, 9], resources: ['E-3', 'L-1'], boqAllocated: 1240, boqTotal: 1240, constraints: 'SNET' },
      { id: 'T-202', name: 'Stone soling layer', type: 'Work', start: 9, duration: 3, progress: 88, baseline: [9, 12], resources: ['L-1', 'L-2'], boqAllocated: 285, boqTotal: 320 },
      { id: 'T-203', name: 'PCC M15 pouring', type: 'Work', start: 11, duration: 4, progress: 62, baseline: [12, 16], resources: ['L-1', 'E-4'], boqAllocated: 88, boqTotal: 88, critical: true },
      { id: 'T-204', name: 'PCC curing period', type: 'Work', start: 14, duration: 5, progress: 25, baseline: [15, 20], resources: [], constraints: 'FS+5' },
    ],
  },
  {
    id: 'T-300', name: 'Box Culvert Construction', type: 'Summary', start: 14, duration: 20, progress: 35, baseline: [13, 33], resources: [],
    children: [
      { id: 'T-301', name: 'Hammock — Tunneling uncertain', type: 'Hammock', start: 14, duration: 18, progress: 35, baseline: [13, 31], resources: ['L-3'], constraints: 'Must Finish On: Wk 32', critical: true },
      { id: 'T-302', name: 'Base slab concrete', type: 'Work', start: 14, duration: 5, progress: 70, baseline: [14, 19], resources: ['L-1', 'E-4'] },
      { id: 'T-303', name: 'Wall & slab rebar', type: 'Work', start: 18, duration: 8, progress: 12, baseline: [18, 26], resources: ['L-1', 'L-2'], critical: true },
    ],
  },
  {
    id: 'T-400', name: 'Pavement Works', type: 'Summary', start: 30, duration: 18, progress: 8, baseline: [30, 48], resources: [],
    children: [
      { id: 'T-401', name: 'Subgrade preparation', type: 'Work', start: 30, duration: 6, progress: 25, baseline: [30, 36], resources: ['E-3'] },
      { id: 'T-402', name: 'DBM 50mm layer', type: 'Work', start: 35, duration: 8, progress: 0, baseline: [36, 44], resources: ['E-5', 'L-4'] },
      { id: 'T-403', name: 'BC wearing course', type: 'Work', start: 42, duration: 6, progress: 0, baseline: [44, 50], resources: ['E-5'] },
      { id: 'T-404', name: 'Road opening milestone', type: 'Milestone', start: 48, duration: 0, progress: 0, baseline: [50, 50], resources: [], constraints: 'MFO: Wk 48' },
    ],
  },
]

const TOTAL_WEEKS = 52
const WEEK_WIDTH = 26

function flattenTasks(items: Task[]): { task: Task; depth: number }[] {
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

export function SchedulerModule() {
  // Persistent state — survives page refreshes via localStorage
  const [selectedId, setSelectedId] = usePersistentState('omnisite-scheduler-selected', 'T-203')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>('omnisite-scheduler-expanded', ['T-100', 'T-200', 'T-300', 'T-400'])
  const [tasks, setTasks] = usePersistentState<Task[]>('omnisite-scheduler-tasks', () => JSON.parse(JSON.stringify(TASKS)))
  // Non-persistent UI state
  const [showResources, setShowResources] = useState(false)
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [dragging, setDragging] = useState<
    | { id: string; startX: number; originalStart: number; mode: 'move' }
    | { id: string; startX: number; originalDuration: number; mode: 'resize' }
    | null
  >(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // EOT / Critical Path Breach modal
  const [breachModal, setBreachModal] = useState(false)
  const [breachTask, setBreachTask] = useState<Task | null>(null)
  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)
  // Add Task modal state
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    name: '',
    type: 'Work' as Task['type'],
    start: 18,
    duration: 5,
    progress: 0,
    constraints: 'ASAP',
    critical: false,
  })

  const flat = flattenTasks(tasks)
  const visible = flat.filter(({ task }) => {
    if (task.type === 'Work' || task.type === 'Milestone' || task.type === 'Hammock') return true
    return true
  })
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
    setNewTask({ name: '', type: 'Work', start: 18, duration: 5, progress: 0, constraints: 'ASAP', critical: false })
  }

  const toggleExpand = (id: string) => {
    setExpandedArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const renderTaskRows = () => {
    const rows: React.ReactNode[] = []
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
              <span className="font-mono tabular-nums">{t.duration}d</span>
              {t.baseline && t.baseline[1] - t.baseline[0] !== t.duration && t.type !== 'Summary' && (
                <span className="text-[9px] text-muted-foreground line-through ml-1">
                  {t.baseline[1] - t.baseline[0]}d
                </span>
              )}
            </div>
            <div className="w-14 flex-shrink-0 text-right pr-2 font-mono">{t.progress}%</div>
          </div>
        )
        if (hasChildren && isExpanded) walk(t.children!, depth + 1)
      }
    }
    walk(tasks, 0)
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
      // Check for Critical Path Breach on drag end
      const updated = tasks.find(t => t.id === dragging?.id)
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
      setDragging(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return (
    <>
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Task Outline">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)] space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter tasks…" className="h-8 pl-7 text-xs" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showCriticalOnly} onCheckedChange={setShowCriticalOnly} />
              <span>Critical path only</span>
            </label>
          </div>
          <PaneBody className="py-2">{renderTaskRows()}</PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Total tasks</span><span className="font-mono">{flat.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Critical path</span><span className="font-mono text-red-500">4 tasks · 28 days</span></div>
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
            <Button variant="ghost" size="sm" className="h-7 text-xs"><Gauge className="w-3.5 h-3.5" />Level</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAddTaskOpen(true)}><Plus className="w-3.5 h-3.5" />Task</Button>
          </PaneHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Gantt canvas */}
            <div className="flex-1 overflow-auto">
              <div className="inline-block min-w-full">
                {/* Week ruler */}
                <div className="sticky top-0 z-10 flex h-8 vibrancy border-b border-[var(--pane-divider)]">
                  <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex items-center px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Task
                  </div>
                  <div className="flex" style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}>
                    {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                      const isMonthStart = i % 4 === 0
                      const isWeekend = false
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex-shrink-0 text-center text-[10px] border-r border-[var(--pane-divider)] flex items-center justify-center',
                            isMonthStart ? 'font-semibold text-foreground' : 'text-muted-foreground',
                            isWeekend && 'gantt-weekend'
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
                  {(() => {
                    const rows: React.ReactNode[] = []
                    const walk = (items: Task[], depth: number) => {
                      for (const t of items) {
                        const isExpanded = expanded.has(t.id)
                        const hasChildren = t.children && t.children.length > 0
                        const isSelected = t.id === selectedId
                        const isHovered = hoveredId === t.id
                        const isDragging = dragging?.id === t.id
                        const left = t.start * WEEK_WIDTH
                        const width = Math.max(t.duration * WEEK_WIDTH, t.type === 'Milestone' ? 12 : 6)
                        const baseLeft = t.baseline[0] * WEEK_WIDTH
                        const baseWidth = Math.max((t.baseline[1] - t.baseline[0]) * WEEK_WIDTH, 4)
                        const varianceWeeks = t.start - t.baseline[0]
                        rows.push(
                          <div
                            key={t.id}
                            onClick={() => setSelectedId(t.id)}
                            className={cn(
                              'flex items-stretch border-b border-[var(--pane-divider)] cursor-pointer row-hover transition-colors',
                              isSelected && 'bg-accent/40',
                              t.critical && 'bg-red-500/5'
                            )}
                          >
                            <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex items-center text-xs" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                              <div className="w-6">
                                {hasChildren && (
                                  <button onClick={e => { e.stopPropagation(); toggleExpand(t.id) }} className="p-0.5">
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              <span className="w-16 font-mono text-muted-foreground text-[10px]">{t.id}</span>
                              <span className={cn('truncate', t.type === 'Summary' && 'font-semibold', t.critical && 'text-red-600 dark:text-red-400')}>{t.name}</span>
                              {varianceWeeks !== 0 && t.type === 'Work' && (
                                <span className={cn('ml-2 text-[9px] font-mono px-1 rounded', varianceWeeks > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
                                  {varianceWeeks > 0 ? '+' : ''}{varianceWeeks}w
                                </span>
                              )}
                            </div>
                            <div className="relative h-8 gantt-grid" style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}>
                              {/* Baseline ghost */}
                              <div
                                className="absolute h-3 top-2.5 rounded-sm border border-dashed border-muted-foreground/40 bg-muted-foreground/5"
                                style={{ left: baseLeft, width: baseWidth }}
                              />
                              {/* Bar */}
                              {t.type === 'Milestone' ? (
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 w-0 h-0"
                                  style={{
                                    left: left - 6,
                                    borderLeft: '6px solid transparent',
                                    borderRight: '6px solid transparent',
                                    borderBottom: '10px solid var(--warning)',
                                  }}
                                />
                              ) : (
                                <div
                                  onMouseDown={(e) => onBarMouseDown(e, t)}
                                  onMouseEnter={() => setHoveredId(t.id)}
                                  onMouseLeave={() => setHoveredId(null)}
                                  className={cn(
                                    'absolute top-1.5 h-5 rounded-sm flex items-center px-1.5 text-[9px] text-white font-medium overflow-hidden shadow-sm group transition-shadow',
                                    isDragging && 'shadow-lg ring-2 ring-white/50 cursor-grabbing scale-y-110 z-30',
                                    !isDragging && 'cursor-grab hover:shadow-md',
                                    t.type === 'Summary' && 'bg-muted-foreground/60 cursor-default',
                                    t.type === 'Hammock' && 'bg-gradient-to-r from-violet-500 to-purple-500',
                                    t.type === 'Work' && (t.critical ? 'bg-red-500' : 'bg-primary'),
                                  )}
                                  style={{ left, width }}
                                >
                                  <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${t.progress}%` }} />
                                  <span className="relative z-10 truncate pointer-events-none">{t.duration}d · {t.progress}%</span>
                                  {/* Resize handles — left edge moves, right edge resizes duration */}
                                  {t.type !== 'Summary' && (
                                    <>
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-2 bg-white/40 opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-white/70"
                                        onMouseDown={(e) => onBarMouseDown(e, t)}
                                      />
                                      <div
                                        className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-white/70"
                                        onMouseDown={(e) => onResizeMouseDown(e, t)}
                                      />
                                    </>
                                  )}
                                  {/* Hover tooltip */}
                                  {isHovered && !isDragging && (
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 pane border border-[var(--pane-divider)] rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap shadow-md z-40 pointer-events-none">
                                      Wk {t.start + 1} → Wk {t.start + t.duration + 1} · drag body to move, edges to resize
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Critical path dependency arrow (simple visual) */}
                              {t.critical && t.type === 'Work' && (
                                <div className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-red-500" style={{ left: left - 4 }} />
                              )}
                            </div>
                          </div>
                        )
                        if (hasChildren && isExpanded) walk(t.children!, depth + 1)
                      }
                    }
                    walk(tasks, 0)
                    return rows
                  })()}
                  {/* Today vertical line */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
                    style={{ left: `calc(480px + ${todayWeek * WEEK_WIDTH}px)` }}
                  >
                    <div className="absolute -top-0 -translate-x-1/2 px-1 py-0.5 bg-red-500 text-white text-[9px] rounded-b font-semibold">TODAY</div>
                  </div>

                  {/* Live collaborator cursors (simulated WebSocket presence) */}
                  <CollaboratorCursors />
                </div>

                {/* Resource usage panel (toggle) */}
                {showResources && (
                  <div className="border-t-2 border-[var(--pane-divider)] bg-secondary/20">
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resource Usage · Weekly hours</div>
                    <div className="relative h-32">
                      <div className="absolute inset-0 flex">
                        <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex flex-col justify-center px-3 text-xs gap-1">
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-500" /> Mason (Skilled)</div>
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-500" /> Mazdoor (Unskilled)</div>
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-amber-500" /> Mixer Operator</div>
                        </div>
                        <div className="flex-1 relative">
                          {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                            const mason = 30 + 25 * Math.sin(i / 3)
                            const maz = 50 + 30 * Math.cos(i / 4)
                            const mx = 10 + 5 * Math.sin(i / 2)
                            const overAlloc = mason > 50 || maz > 80
                            return (
                              <div key={i} className="absolute bottom-0 group flex flex-col justify-end items-center" style={{ left: i * WEEK_WIDTH, width: WEEK_WIDTH }}>
                                <div className="w-full bg-blue-500/70 group-hover:bg-blue-500" style={{ height: `${mason}px` }} />
                                <div className="w-full bg-emerald-500/70 group-hover:bg-emerald-500" style={{ height: `${maz}px` }} />
                                <div className="w-full bg-amber-500/70" style={{ height: `${mx}px` }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      }
      rightPane={<TaskInspector task={selectedTask} />}
      leftPaneWidth="320px"
      rightPaneWidth="380px"
    />

      {/* Add Task Modal */}
      {addTaskOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAddTaskOpen(false)}
        >
          <div
            className="w-full max-w-md pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-primary/5">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Add New Task</span>
              </div>
              <button onClick={() => setAddTaskOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Task name */}
              <div>
                <label className="text-xs font-medium">Task Name <span className="text-red-500">*</span></label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. PCC M20 pouring at pier P-5"
                  value={newTask.name}
                  onChange={(e) => setNewTask(t => ({ ...t, name: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Task type */}
              <div>
                <label className="text-xs font-medium">Task Type</label>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {(['Work', 'Milestone', 'Hammock', 'Summary'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setNewTask(prev => ({ ...prev, type: t }))}
                      className={cn(
                        'h-8 rounded text-[11px] border transition-colors',
                        newTask.type === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-[var(--pane-divider)] hover:bg-accent'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start week + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Start Week</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      className="h-8 text-xs w-20"
                      min={0}
                      max={TOTAL_WEEKS - 1}
                      value={newTask.start}
                      onChange={(e) => setNewTask(t => ({ ...t, start: Math.max(0, Math.min(TOTAL_WEEKS - 1, parseInt(e.target.value) || 0)) }))}
                    />
                    <span className="text-[10px] text-muted-foreground">→ Wk {newTask.start + 1}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Duration (weeks)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      className="h-8 text-xs w-20"
                      min={1}
                      max={TOTAL_WEEKS - newTask.start}
                      value={newTask.duration}
                      onChange={(e) => setNewTask(t => ({ ...t, duration: Math.max(1, Math.min(TOTAL_WEEKS - t.start, parseInt(e.target.value) || 1)) }))}
                      disabled={newTask.type === 'Milestone'}
                    />
                    <span className="text-[10px] text-muted-foreground">→ Wk {newTask.start + newTask.duration + 1}</span>
                  </div>
                </div>
              </div>

              {/* Constraints */}
              <div>
                <label className="text-xs font-medium">Constraint</label>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {['ASAP', 'SNET', 'FNLT', 'MFO', 'MSO', 'ALAP'].map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTask(t => ({ ...t, constraints: c }))}
                      className={cn(
                        'h-7 rounded text-[10px] border transition-colors font-mono',
                        newTask.constraints === c
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-[var(--pane-divider)] hover:bg-accent'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Critical path toggle */}
              <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)] cursor-pointer hover:bg-accent/30">
                <input
                  type="checkbox"
                  checked={newTask.critical}
                  onChange={(e) => setNewTask(t => ({ ...t, critical: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-xs flex-1">Mark as critical path task</span>
                <span className="text-[10px] text-red-500">highlighted in red</span>
              </label>

              {/* Preview */}
              <div className="p-2.5 rounded-md bg-secondary/30 text-[11px]">
                <div className="text-[10px] text-muted-foreground mb-1">Preview</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">T-new</span>
                  <span className="font-medium">{newTask.name || 'New Task'}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Wk {newTask.start + 1} → Wk {newTask.start + newTask.duration + 1} · {newTask.duration}w
                  </span>
                </div>
                {/* Mini bar preview */}
                <div className="mt-2 h-4 relative bg-secondary rounded-sm overflow-hidden">
                  <div
                    className={cn(
                      'absolute h-full rounded-sm',
                      newTask.critical ? 'bg-red-500' : 'bg-primary',
                      newTask.type === 'Milestone' && 'bg-amber-500',
                      newTask.type === 'Hammock' && 'bg-violet-500',
                      newTask.type === 'Summary' && 'bg-muted-foreground/60'
                    )}
                    style={{ left: `${(newTask.start / TOTAL_WEEKS) * 100}%`, width: `${Math.max((newTask.duration / TOTAL_WEEKS) * 100, 2)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--pane-divider)] bg-secondary/20">
              <Button variant="outline" size="sm" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!newTask.name.trim()}
                onClick={addTask}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Critical Path Breach / EOT Modal */}
      {breachModal && breachTask && (
        <CriticalPathBreachModal
          task={breachTask}
          onClose={() => { setBreachModal(false); setBreachTask(null) }}
          onEotClaim={() => {
            toast.success('EOT Claim initiated', { description: `${breachTask.id} — Extension of Time claim drafted in Correspondence module.` })
            setBreachModal(false); setBreachTask(null)
          }}
          onAccelerate={() => {
            toast.success('Acceleration plan initiated', { description: `${breachTask.id} — Resource acceleration plan drafted. Additional cost will be pushed to Financials.` })
            setBreachModal(false); setBreachTask(null)
          }}
        />
      )}
    </>
  )
}

// ─── Critical Path Breach Modal ──────────────────────────────────────────────

function CriticalPathBreachModal({ task, onClose, onEotClaim, onAccelerate }: {
  task: Task
  onClose: () => void
  onEotClaim: () => void
  onAccelerate: () => void
}) {
  const match = task.constraints?.match(/Wk (\d+)/)
  const deadlineWeek = match ? parseInt(match[1]) : 0
  const finishWeek = task.start + task.duration
  const overrunWeeks = finishWeek - deadlineWeek
  const overrunDays = overrunWeeks * 7

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg pane border border-red-500/40 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-red-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600">⚠️ Critical Path Breach</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Breach details */}
          <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs space-y-1.5">
            <div className="font-medium text-red-600">{task.id} — {task.name}</div>
            <div className="text-muted-foreground">
              This Hammock task (quantity-driven) has expanded beyond its Must Finish On deadline.
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Deadline</div>
                <div className="font-mono font-bold">Wk {deadlineWeek}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Forecast Finish</div>
                <div className="font-mono font-bold text-red-600">Wk {finishWeek}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Overrun</div>
                <div className="font-mono font-bold text-red-600">+{overrunWeeks}w ({overrunDays}d)</div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Resolution Option</div>

            {/* EOT Claim */}
            <button
              onClick={onEotClaim}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--pane-divider)] hover:border-primary/40 hover:bg-accent/30 text-left transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">File EOT Claim</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Extension of Time claim per FIDIC Clause 8.4. Drafts a formal letter to the Engineer with impact analysis. Timeline moves by +{overrunWeeks} weeks. No cost penalty.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </button>

            {/* Acceleration */}
            <button
              onClick={onAccelerate}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--pane-divider)] hover:border-primary/40 hover:bg-accent/30 text-left transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Accelerate (Crash Schedule)</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Add resources (extra shifts, additional equipment) to recover the {overrunWeeks}-week overrun. Estimated acceleration cost: NPR {(overrunWeeks * 850000).toLocaleString()}. Pushes to Financials as a variation.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </button>
          </div>

          {/* FIDIC reference */}
          <div className="p-2 rounded-md bg-secondary/30 text-[10px] text-muted-foreground">
            <span className="font-medium">FIDIC Reference:</span> Sub-Clause 8.4 (Extension of Time) and Sub-Clause 8.6 (Rate of Progress). The Contractor shall be entitled to an EOT if the delay is caused by a Variation, exceptionally adverse weather, or unforeseen ground conditions.
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskInspector({ task }: { task: Task }) {
  return (
    <>
      <PaneHeader title={`Task Inspector · ${task.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
            {task.critical && <Badge variant="destructive" className="text-[10px]">Critical</Badge>}
            {task.constraints && <Badge variant="secondary" className="text-[10px]">{task.constraints}</Badge>}
          </div>
          <div className="text-sm font-semibold leading-snug">{task.name}</div>
        </div>

        <Tabs defaultValue="schedule">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-4 h-8 text-xs w-full">
              <TabsTrigger value="schedule" className="text-[11px]">Schedule</TabsTrigger>
              <TabsTrigger value="assign" className="text-[11px]">Assign</TabsTrigger>
              <TabsTrigger value="boq" className="text-[11px]">BOQ/RA</TabsTrigger>
              <TabsTrigger value="evm" className="text-[11px]">EVM</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Start</label>
                <div className="flex items-center gap-1.5 mt-1 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">Wk {task.start + 1}</span>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Finish</label>
                <div className="flex items-center gap-1.5 mt-1 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">Wk {task.start + task.duration + 1}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Duration (days)</label>
              <Input className="mt-1 h-8 text-xs" defaultValue={task.duration} />
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Constraint</label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {['ASAP', 'ALAP', 'SNET', 'FNLT', 'MFO', 'MSO'].map(c => (
                  <button key={c} className={cn(
                    'h-7 rounded text-[11px] border transition-colors',
                    task.constraints?.includes(c)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-[var(--pane-divider)] hover:bg-accent'
                  )}>{c}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1">
              <Switch defaultChecked />
              <span>Effort-driven scheduling</span>
            </label>
            <Separator />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dependencies</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
                <Link2 className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[10px]">T-201</span>
                <Badge variant="secondary" className="text-[9px]">FS</Badge>
                <span className="flex-1 text-[10px] text-muted-foreground">Excavation ch. 0+000</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
                <Link2 className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[10px]">T-204</span>
                <Badge variant="secondary" className="text-[9px]">SS+2</Badge>
                <span className="flex-1 text-[10px] text-muted-foreground">Curing period</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assign" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role → Name assignment</div>
            <AssignRow role="Site Engineer" name="Bikash Rai" hours={8} over={false} />
            <AssignRow role="Mason (Skilled)" name="Ram Bahadur" hours={6} over={false} />
            <AssignRow role="Mazdoor" name="3 workers" hours={8} over={false} />
            <AssignRow role="Mixer Operator" name="Hari K." hours={4} over={true} />
            <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
              <div>
                <div className="font-medium">Over-allocation detected</div>
                <div className="text-muted-foreground">Hari K. is assigned 12 hrs/day across T-203 + T-301. Auto-Level suggests delaying T-301 by 2 days.</div>
                <Button size="sm" variant="outline" className="h-6 mt-1.5 text-[10px] gap-1"><Zap className="w-3 h-3" />Auto-Level</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boq" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BOQ Allocation</div>
            <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
              <div className="text-[10px] text-muted-foreground">Item 1.1.3 — PCC M15 (1:2:4) below footing</div>
              <div className="text-sm font-medium mt-0.5">145 cum allocated</div>
              <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '60%' }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
                <span>Allocated: 145 cum</span>
                <span>Used: 87 / 145 cum</span>
              </div>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Material Lead-Time Check</div>
            <div className="space-y-1.5">
              <LeadRow mat="Cement OPC 53" req="87 bags × 4.5 = 392 bags" status="ok" po="PO-018 · 1,200 bags on site" />
              <LeadRow mat="River Sand" req="39 cum" status="ok" po="PO-014 · delivered 12 Aug" />
              <LeadRow mat="Coarse Agg. 20mm" req="78 cum" status="warn" po="PO-022 · ETA 18 Aug" />
            </div>
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
              <div>
                <div className="font-medium">Resource Constrained</div>
                <div className="text-muted-foreground">Coarse Aggregate delivery (PO-022) slips past task start. Task delayed by 2 days.</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evm" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Earned Value Metrics</div>
            <div className="grid grid-cols-2 gap-2">
              <EvmCard label="BCWS" name="Planned Value" value="NPR 1.42M" icon={<TrendingUp className="w-3.5 h-3.5" />} />
              <EvmCard label="BCWP" name="Earned Value" value="NPR 0.88M" icon={<Activity className="w-3.5 h-3.5" />} />
              <EvmCard label="ACWP" name="Actual Cost" value="NPR 0.95M" icon={<TrendingDown className="w-3.5 h-3.5" />} />
              <EvmCard label="EAC" name="Estimate at Comp." value="NPR 1.58M" icon={<Gauge className="w-3.5 h-3.5" />} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="SPI" value="0.62" trend="down" desc="Behind schedule" />
              <Kpi label="CPI" value="0.93" trend="down" desc="Over budget" />
            </div>
            <div className="p-2 rounded-md bg-secondary/40 text-[11px]">
              <div className="text-muted-foreground mb-1">Variance Analysis</div>
              <div className="flex justify-between"><span>Schedule Variance</span><span className="font-mono text-red-500">-540K</span></div>
              <div className="flex justify-between"><span>Cost Variance</span><span className="font-mono text-red-500">-70K</span></div>
              <div className="flex justify-between"><span>VAC (Forecast)</span><span className="font-mono text-red-500">-160K</span></div>
            </div>
            <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">DSR Linkage (locked % done)</div>
              <div className="flex justify-between"><span>Planned qty</span><span className="font-mono">145 cum</span></div>
              <div className="flex justify-between"><span>Actual (DSR)</span><span className="font-mono">87 cum</span></div>
              <div className="flex justify-between font-medium"><span>Computed % done</span><span className="font-mono">60% (locked)</span></div>
            </div>
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

function AssignRow({ role, name, hours, over }: { role: string; name: string; hours: number; over: boolean }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold">
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground">{role}</div>
        <div className="font-medium truncate">{name}</div>
      </div>
      <div className={cn('text-[10px] font-mono', over && 'text-red-500')}>{hours}h/d</div>
    </div>
  )
}

function LeadRow({ mat, req, status, po }: { mat: string; req: string; status: 'ok' | 'warn' | 'block'; po: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <Package className={cn('w-3.5 h-3.5', status === 'ok' && 'text-emerald-500', status === 'warn' && 'text-amber-500', status === 'block' && 'text-red-500')} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{mat}</div>
        <div className="text-[10px] text-muted-foreground">{req} · {po}</div>
      </div>
    </div>
  )
}

function EvmCard({ label, name, value, icon }: { label: string; name: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
      <div className="text-[10px] text-muted-foreground">{name}</div>
    </div>
  )
}

function Kpi({ label, value, trend, desc }: { label: string; value: string; trend: 'up' | 'down'; desc: string }) {
  return (
    <div className="p-2 rounded-md bg-secondary/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {trend === 'up'
          ? <TrendingUp className="w-3 h-3 delta-up" />
          : <TrendingDown className="w-3 h-3 delta-down" />}
      </div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </div>
  )
}
