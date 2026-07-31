'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Mountain } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subcontractor } from './types'

// ─── Schedule Linkage Tab ────────────────────────────────────────────────────

export function ScheduleTab({ sc }: { sc: Subcontractor }) {
  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Schedule Linkage (assigned tasks)
      </div>

      <div className="space-y-2">
        {sc.assignedTasks.map(t => (
          <div key={t.taskId} className="rounded-md border border-[var(--pane-divider)] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-muted-foreground">{t.taskId}</span>
              <Badge variant="secondary" className={cn('text-[9px]', t.status === 'delayed' && 'bg-red-500/15 text-red-700 dark:text-red-300', t.status === 'on-track' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
                {t.status}
              </Badge>
            </div>
            <div className="font-medium text-xs">{t.taskName}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{t.baseline}</div>
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full', t.status === 'delayed' ? 'bg-red-500' : 'bg-primary')} style={{ width: `${t.progress}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{t.progress}%</span>
            </div>
          </div>
        ))}
      </div>

      {sc.isTunneling && (
        <div className="p-2.5 rounded-md bg-violet-500/10 border border-violet-500/30 text-[10px]">
          <div className="font-medium flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
            <Mountain className="w-3 h-3" />Hammock Task — Quantity-Driven
          </div>
          <div className="text-muted-foreground mt-1">
            Duration expands/contracts based on cumulative face log advance. If it pushes past the Must Finish On deadline, triggers Critical Path Breach modal with EOT claim or acceleration options.
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Assign Schedule Task</Button>
    </div>
  )
}
