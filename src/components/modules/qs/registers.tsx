'use client'

// ─── Q&S left pane — register filter chips + search + billing holds ─────────
// Extracted from the monolithic qs.tsx. Renders the left pane of the
// Workspace2Pane layout: the category filter list (All / ITR / NCR / Punch /
// Incident / Near-Miss) with per-type counts, a search input, and the
// "Billing Holds" summary at the bottom.

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type QsItem, type QsFilter, QS_FILTERS } from './types'

export function QsRegistersPane({
  items,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: {
  items: QsItem[]
  filter: QsFilter
  onFilterChange: (f: QsFilter) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  return (
    <>
      <PaneHeader title="Categories">
        <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PaneHeader>
      <PaneBody className="py-2">
        {QS_FILTERS.map((f) => {
          const count = f === 'All' ? items.length : items.filter((i) => i.type === f).length
          return (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                filter === f
                  ? 'bg-accent border-primary border-l-2'
                  : 'hover:bg-accent/50 border-l-2 border-transparent'
              )}
            >
              <span className="flex items-center gap-2">
                {f === 'ITR' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                {f === 'NCR' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                {f === 'Punch' && <FileText className="h-3 w-3 text-amber-500" />}
                {f === 'Incident' && <XCircle className="h-3 w-3 text-red-500" />}
                {f === 'Near-Miss' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                {f === 'All' && <ShieldCheck className="text-muted-foreground h-3 w-3" />}
                {f}
              </span>
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                {count}
              </Badge>
            </button>
          )
        })}
        <div className="mt-4 px-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search register…"
              className="h-8 pl-7 text-xs"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </PaneBody>
      <div className="space-y-1.5 border-t border-[var(--pane-divider)] p-3 text-xs">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Billing Holds
        </div>
        {(() => {
          const holds = items.filter((i) => i.billingHold)
          if (holds.length === 0) {
            return (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-600">
                No active billing holds
              </div>
            )
          }
          return holds.map((h) => (
            <div key={h.id} className="rounded-md border border-red-500/30 bg-red-500/10 p-2">
              <div className="flex items-center gap-1.5 font-medium text-red-600">
                <Lock className="h-3 w-3" />
                {h.id} hold active
              </div>
              <div className="text-muted-foreground mt-0.5 text-[10px]">{h.title}</div>
            </div>
          ))
        })()}
      </div>
    </>
  )
}
