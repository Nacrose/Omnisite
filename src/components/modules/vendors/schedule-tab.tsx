'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Mountain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor } from './types'

// ─── Schedule Linkage Tab ────────────────────────────────────────────────────

export function ScheduleTab({ sc }: { sc: Subcontractor }) {
  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Schedule Linkage (assigned tasks)
      </div>

      <div className="space-y-2">
        {sc.assignedTasks.map((t) => (
          <div key={t.taskId} className="rounded-md border border-[var(--pane-divider)] p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground font-mono text-[10px]">{t.taskId}</span>
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px]',
                  t.status === 'delayed' && 'bg-red-500/15 text-red-700 dark:text-red-300',
                  t.status === 'on-track' &&
                    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                )}
              >
                {t.status}
              </Badge>
            </div>
            <div className="text-xs font-medium">{t.taskName}</div>
            <div className="text-muted-foreground mt-0.5 text-[10px]">{t.baseline}</div>
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    t.status === 'delayed' ? 'bg-red-500' : 'bg-primary'
                  )}
                  style={{ width: `${t.progress}%` }}
                />
              </div>
              <span className="text-muted-foreground w-10 text-right font-mono text-[10px]">
                {t.progress}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {sc.isTunneling && (
        <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-2.5 text-[10px]">
          <div className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
            <Mountain className="h-3 w-3" />
            Hammock Task — Quantity-Driven
          </div>
          <div className="text-muted-foreground mt-1">
            Duration expands/contracts based on cumulative face log advance. If it pushes past the
            Must Finish On deadline, triggers Critical Path Breach modal with EOT claim or
            acceleration options.
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={() =>
          toast.info('Task assignment coming soon', {
            description:
              'Use the Scheduler module to assign tasks to this vendor. The Schedule Linkage tab will then reflect the assignment.',
          })
        }
        title="Assign Schedule Task"
      >
        <Plus className="h-3.5 w-3.5" />
        Assign Schedule Task
      </Button>
    </div>
  )
}
