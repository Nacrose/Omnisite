'use client'

// ─── Urgent Actions Queue card ───────────────────────────────────────────────
// Extracted from the monolithic dashboard.tsx. Renders the list of
// time-sensitive items (PO approvals, NCR holds, RFI replies, etc.) in a
// scrollable Card. Each row is clickable and routes to the relevant module
// via the onNavigate callback.

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock } from 'lucide-react'
import { type ModuleId } from '@/lib/app-store'

export interface UrgentAction {
  type: string
  desc: string
  who: string
  due: string
  severity: 'high' | 'critical' | 'medium'
  module: ModuleId
}

const URGENT_ACTIONS: UrgentAction[] = [
  {
    type: 'PO Approval',
    desc: 'PO-2410-018 — Cement (Ordinary) 1,200 bags',
    who: 'Engr.',
    due: 'Today',
    severity: 'high',
    module: 'procurement',
  },
  {
    type: 'DSR Review',
    desc: 'DSR #087 — Chainage 4+200 to 4+350 PCC',
    who: 'Bikash R.',
    due: 'Today',
    severity: 'high',
    module: 'daily-ops',
  },
  {
    type: 'NCR Hold',
    desc: 'NCR-034 — Box culvert rebar cover < 40mm',
    who: 'Engineer',
    due: 'Open',
    severity: 'critical',
    module: 'qs',
  },
  {
    type: 'Variation',
    desc: 'SI-022 — Extra excavation at chainage 2+850',
    who: 'PM',
    due: '2 days',
    severity: 'medium',
    module: 'correspondence',
  },
  {
    type: 'RFI Reply',
    desc: 'RFI-067 — Rebar detailing at expansion joint',
    who: 'Consultant',
    due: 'Overdue 4d',
    severity: 'critical',
    module: 'daily-ops',
  },
]

export function UrgentActionsQueue({ onNavigate }: { onNavigate: (id: ModuleId) => void }) {
  return (
    <Card className="col-span-12 p-5 lg:col-span-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Urgent Actions Queue
        </h3>
        <Badge variant="secondary" className="text-xs">
          {URGENT_ACTIONS.length}
        </Badge>
      </div>
      <div className="max-h-[280px] space-y-2 overflow-y-auto">
        {URGENT_ACTIONS.map((a, i) => (
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
        ))}
      </div>
    </Card>
  )
}
