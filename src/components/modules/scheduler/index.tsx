'use client'

import { useRef } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Search, Plus } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { GanttCanvas } from './gantt-canvas'
import { TaskInspector } from './task-inspector'
import { AddTaskModal, CriticalPathBreachModal } from './modals'
import { useSchedulerState } from './use-scheduler-state'
import { useSchedulerHandlers } from './use-scheduler-handlers'
import { SchedulerOutline } from './scheduler-outline'
import { SchedulerGanttHeader } from './scheduler-gantt-header'

/**
 * Scheduler module — CPM scheduling, Gantt chart, resource leveling.
 *
 * State + derived memoizations live in `useSchedulerState`. Mutation
 * handlers + drag effect + breach detection live in `useSchedulerHandlers`.
 * The task outline and Gantt header are extracted into their own components.
 * This component is the layout shell — it composes the pieces into the
 * 3-pane workspace and owns no business logic.
 */
export function SchedulerModule() {
  const state = useSchedulerState()
  const handlers = useSchedulerHandlers(state)
  const canvasRef = useRef<HTMLDivElement>(null)

  const {
    tasks,
    tasksLoading,
    taskTree,
    tasksWithCpm,
    selectedId,
    setSelectedId,
    expanded,
    showResources,
    setShowResources,
    showCriticalOnly,
    setShowCriticalOnly,
    searchQuery,
    setSearchQuery,
    dragging,
    hoveredId,
    setHoveredId,
    breachModal,
    setBreachModal,
    breachTask,
    setBreachTask,
    addTaskOpen,
    setAddTaskOpen,
    newTask,
    setNewTask,
    flat,
    selectedTask,
    projectFinishWeek,
    effectiveWeeks,
    todayWeek,
    filteredTasks,
    filteredFlat,
  } = state

  const {
    updateTaskDuration,
    updateTaskProgress,
    updateTaskLocation,
    updateTaskConstraint,
    updateTaskResources,
    checkBreach,
    addTask,
    toggleExpand,
    onBarMouseDown,
    onResizeMouseDown,
    levelResourcesNow,
  } = handlers

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
            <PaneBody className="py-2">
              <SchedulerOutline
                filteredTasks={filteredTasks}
                expanded={expanded}
                selectedId={selectedId}
                showCriticalOnly={showCriticalOnly}
                onSelect={setSelectedId}
                onToggleExpand={toggleExpand}
              />
            </PaneBody>
            <div className="space-y-1 border-t border-[var(--pane-divider)] p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total tasks</span>
                <span className="font-mono">{flat.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Critical path</span>
                <span className="font-mono text-red-500">
                  {/* Count both Work and Hammock critical tasks — Hammock tasks
                    are included in CPM (R5-3), so they can be critical too
                    (e.g. seed T-301). Previously only Work tasks were counted,
                    undercounting the critical path (audit S8-5). */}
                  {/* Memoized inline via IIFE to avoid filtering twice on
                    every render — previously this ran flat.filter(...).length
                    AND flat.filter(...).reduce(...), two passes over the
                    same array for the same predicate (audit round 10). */}
                  {(() => {
                    const criticalTasks = flat.filter(
                      (f) =>
                        f.task.critical && (f.task.type === 'Work' || f.task.type === 'Hammock')
                    )
                    return `${criticalTasks.length} tasks · ${criticalTasks.reduce(
                      (s, f) => s + f.task.duration,
                      0
                    )}w`
                  })()}
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
            <PaneHeader title={`Gantt Canvas · W1 to W${effectiveWeeks}`}>
              <SchedulerGanttHeader
                effectiveWeeks={effectiveWeeks}
                showResources={showResources}
                onToggleResources={setShowResources}
                onAddTask={() => setAddTaskOpen(true)}
                onLevelResources={levelResourcesNow}
              />
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
              totalWeeks={effectiveWeeks}
              canvasRef={canvasRef}
            />
          </>
        }
        rightPane={
          <TaskInspector
            key={selectedTask.id}
            task={selectedTask}
            totalWeeks={effectiveWeeks}
            onUpdateDuration={updateTaskDuration}
            onUpdateProgress={updateTaskProgress}
            onUpdateLocation={(locId) => {
              // Propagate the location link into the synced tasks store so
              // it persists to Supabase (location_id column added in
              // migration 12) and is visible to other modules. Without this
              // the inspector only kept the link in local state.
              updateTaskLocation(selectedTask.id, locId)
            }}
            onUpdateConstraint={(constraint) => {
              // Propagate the picked constraint code (ASAP/ALAP/SNET/FNLT/MFO/MSO)
              // into the synced tasks store so it persists to Supabase and is
              // visible to the EOT breach detector. ALSO check for a breach
              // immediately — the constraint change doesn't alter the task's
              // start/duration, so we can check the breach against the
              // selected task's CURRENT values right now (no need to wait for
              // the state commit). Previously the breach check only fired on
              // drag-end (the most significant coverage gap in the
              // breach-detection feature).
              const taskWithNewConstraint = { ...selectedTask, constraints: constraint }
              checkBreach(taskWithNewConstraint)
              updateTaskConstraint(selectedTask.id, constraint)
            }}
            onUpdateResources={(_id, newResources) => {
              // Propagate the resources array (add/remove from the Assign tab)
              // into the synced tasks store so it persists to Supabase
              // (tasks.resources JSONB column) and is visible to resource
              // leveling. Previously the inspector's add/remove handlers
              // called a no-op localStorage.setItem — the change vanished on
              // refresh.
              //
              // `_id` is the task id passed by the inspector; we use
              // `selectedTask.id` instead because the inspector's local
              // `task.id` mirror could briefly lag the parent's selected task
              // during fast selection switches.
              void _id
              updateTaskResources(selectedTask.id, newResources)
            }}
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
          totalWeeks={effectiveWeeks}
          onClose={() => setAddTaskOpen(false)}
          onSubmit={() => addTask(newTask)}
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
