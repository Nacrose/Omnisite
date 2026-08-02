'use client'

// ─── Urgent Actions Queue card ───────────────────────────────────────────────
// Extracted from the monolithic dashboard.tsx. Renders the list of
// time-sensitive items (PO approvals, NCR holds, RFI replies, etc.) in a
// scrollable Card. Each row is clickable and routes to the relevant module
// via the onNavigate callback.
//
// The actions array is NOT hardcoded here — the parent (dashboard/index.tsx)
// derives it from live data (pending POs, open NCRs, zero-progress tasks,
// GRNs on hold). When nothing is urgent, we say so honestly instead of
// fabricating entries.

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { type ModuleId } from '@/lib/app-store'

export interface UrgentAction {
  type: string
  desc: string
  who: string
  due: string
  severity: 'high' | 'critical' | 'medium'
  module: ModuleId
}

interface UrgentActionsQueueProps {
  onNavigate: (id: ModuleId) => void
  /** Live urgent actions derived from real data by the parent. When empty,
   *  an honest "all clear" placeholder is shown instead of fabricated rows. */
  urgentActions: UrgentAction[]
}

export function UrgentActionsQueue({ onNavigate, urgentActions }: UrgentActionsQueueProps) {
  const count = urgentActions.length
  return (
    <Card className="col-span-12 p-5 lg:col-span-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Urgent Actions Queue
        </h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      <div className="max-h-[280px] space-y-2 overflow-y-auto">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <div className="text-sm font-medium">All clear — no urgent actions</div>
            <div className="text-muted-foreground text-[11px]">
              No pending POs, overdue NCRs, stalled tasks, or GRN payment holds.
            </div>
          </div>
        ) : (
          urgentActions.map((a, i) => (
            <div
              key={i}
              onClick={() => onNavigate(a.module)}
              className="hover:bg-accent/50 hover:border-primary/30 group cursor-pointer rounded-md border border-[var(--pane-divider)] p-2.5 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div
                  className={`w-1 self-stretch rounded-full ${
                    a.severity === 'critical'
                      ? 'bg-[var(--critical)]'
                      : a.severity === 'high'
                        ? 'bg-[var(--warning)]'
                        : 'bg-[var(--info)]'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{a.type}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{a.who}</span>
                    <span className="text-muted-foreground ml-auto flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {a.due}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs">{a.desc}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
