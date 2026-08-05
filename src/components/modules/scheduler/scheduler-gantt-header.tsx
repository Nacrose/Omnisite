'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Plus, Gauge } from 'lucide-react'

interface SchedulerGanttHeaderProps {
  /** Effective project weeks (drives the title `W1 to W{effectiveWeeks}`). */
  effectiveWeeks: number
  /** Whether the resource-usage overlay is shown on the Gantt. */
  showResources: boolean
  onToggleResources: (v: boolean) => void
  /** Add task callback (opens the modal). */
  onAddTask: () => void
  /** Resource leveling callback. */
  onLevelResources: () => void
}

/**
 * Gantt canvas header (toolbar above the Gantt).
 *
 * Shows the week range, a hint about drag interactions, the resource-usage
 * toggle, and the Level + Add Task buttons.
 *
 * Extracted from `SchedulerModule` so the component body focuses on layout.
 */
export function SchedulerGanttHeader({
  effectiveWeeks,
  showResources,
  onToggleResources,
  onAddTask,
  onLevelResources,
}: SchedulerGanttHeaderProps) {
  return (
    <>
      <span className="text-muted-foreground bg-secondary/60 hidden items-center gap-1.5 rounded px-2 py-0.5 text-[10px] md:flex">
        <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
        Drag bars to move · drag edges to resize
      </span>
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={showResources} onCheckedChange={onToggleResources} />
        <span className="text-muted-foreground">Resource usage</span>
      </label>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onLevelResources}>
        <Gauge className="h-3.5 w-3.5" />
        Level
      </Button>
      <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onAddTask}>
        <Plus className="h-3.5 w-3.5" />
        Task
      </Button>
    </>
  )
}
