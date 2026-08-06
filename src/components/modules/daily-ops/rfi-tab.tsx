'use client'

import { useState, useSyncExternalStore, useEffect } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { subscribeRfis, getRfis, setRfisFromServer, type Rfi } from './rfi-store'
import { useSyncedState } from '@/lib/use-synced-state'
import { RfiInspector } from './rfi-inspector'
import { RfiCreateModal } from './rfi-create-modal'

// Re-export the RFI store + type for backwards compat. New code should import
// from './rfi-store' directly.
export { subscribeRfis, getRfis, addRfi, updateRfi, RFIS } from './rfi-store'
export type { Rfi } from './rfi-store'

export function RfiTab({
  onOpenDsr,
}: {
  /** Fired when the user clicks "Open linked DSR" in the RFI Inspector.
   *  The parent switches to the DSR tab and selects the linked entry
   *  (audit D2-3). */
  onOpenDsr?: (dsrId: string) => void
}) {
  // ─── Server-side RFI store ──────────────────────────────────────────────
  // RfiTab is the only component that calls useSyncedState for RFIs. It
  // pushes the server snapshot into the module-level cache via
  // setRfisFromServer() so other consumers (rfi-inspector, dsr-rfi-modal,
  // the open-RFI count in the Daily Ops header) see the same data via
  // useSyncExternalStore. Without this single-owner pattern, each consumer
  // would create its own Supabase realtime channel + duplicate API fetch.
  //
  // This replaces the previous localStorage-only usePersistentState
  // approach (P1-14 in gap analysis — RFIs now persist to the `rfis`
  // DB table via /api/rfis, with localStorage as the demo-mode fallback).
  const [serverRfis, _setServerRfis, rfisLoading] = useSyncedState<Rfi[]>(
    'omnisite-rfis',
    'rfis',
    () => [] as Rfi[],
    {
      fieldMap: {
        replyBy: 'reply_by',
        repliedDate: 'replied_date',
        linkedDsr: 'linked_dsr',
        costImpact: 'cost_impact',
        scheduleImpact: 'schedule_impact',
        locationId: 'location_id',
      },
      primaryKey: 'id',
    }
  )

  // Push server snapshots into the module-level cache so non-hook consumers
  // (addRfi / updateRfi / getRfis / subscribeRfis) see the latest data.
  // Skipped while loading — the initial seed falls through from
  // INITIAL_RFIS until the first server page arrives.
  useEffect(() => {
    if (!rfisLoading && serverRfis.length > 0) {
      setRfisFromServer(serverRfis)
    }
  }, [serverRfis, rfisLoading])

  // Subscribe to the module-level store — sees both server snapshots
  // (pushed by the effect above) and optimistic writes from addRfi /
  // updateRfi (called by the inspector + create modal).
  const rfis = useSyncExternalStore(subscribeRfis, getRfis, getRfis)
  const [selectedId, setSelectedId] = useState('r1')
  const [filter, setFilter] = useState<'All' | 'Open' | 'Replied' | 'Closed'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  // Create-RFI modal state — opened by the "+" button in the register
  // header (audit D5-1).
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createRfiId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  )
  const selected = rfis.find((r) => r.id === selectedId) ?? rfis[0]

  // If selectedId points to a deleted RFI, sync it (audit D1-6).
  if (selected && selected.id !== selectedId) {
    setSelectedId(selected.id)
  }

  // Filter by status first, then by the search query.
  const filtered = (filter === 'All' ? rfis : rfis.filter((r) => r.status === filter)).filter(
    (r) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        r.number.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q)
      )
    }
  )
  const overdueCount = rfis.filter(
    (r) => r.status === 'Open' && new Date(r.replyBy) < new Date()
  ).length

  // Guard against an empty RFI store. Placed AFTER all hooks.
  if (!selected) {
    return <div className="text-muted-foreground p-4 text-sm">No RFI selected</div>
  }

  return (
    <>
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="RFI Register">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setCreateModalOpen(true)}
                title="Add RFI"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <div className="space-y-2 border-b border-[var(--pane-divider)] px-3 py-2">
              {/* Status filter */}
              <div className="flex gap-1">
                {(['All', 'Open', 'Replied', 'Closed'] as const).map((f) => {
                  const count =
                    f === 'All' ? rfis.length : rfis.filter((r) => r.status === f).length
                  return (
                    <Button
                      key={f}
                      variant={filter === f ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => setFilter(f)}
                    >
                      {f} <span className="ml-1 text-[10px] opacity-70">{count}</span>
                    </Button>
                  )
                })}
              </div>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Filter by number / subject / question…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <PaneBody className="py-2">
              {/* Overdue alert */}
              {overdueCount > 0 && (
                <div className="mx-3 mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[10px]">
                  <div className="flex items-center gap-1.5 font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueCount} RFI overdue
                  </div>
                  <div className="text-muted-foreground mt-0.5">Consultant reply pending.</div>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="text-muted-foreground px-3 py-8 text-center text-[10px]">
                  No RFIs match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filtered.map((r) => {
                  const isOverdue = r.status === 'Open' && new Date(r.replyBy) < new Date()
                  const isSelected = r.id === selectedId
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'hover:bg-accent/50 w-full border-l-2 px-3 py-2 text-left transition-colors',
                        isSelected ? 'bg-accent border-l-primary' : 'border-l-transparent'
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {r.number}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-4 px-1 text-[10px]',
                            r.status === 'Open' &&
                              'border-amber-500/40 text-amber-700 dark:text-amber-300',
                            r.status === 'Replied' &&
                              'border-sky-500/40 text-sky-700 dark:text-sky-300',
                            r.status === 'Closed' &&
                              'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          )}
                        >
                          {r.status}
                        </Badge>
                        {r.severity === 'high' && (
                          <Badge
                            variant="outline"
                            className="h-4 border-red-500/40 px-1 text-[10px] text-red-700 dark:text-red-300"
                          >
                            HIGH
                          </Badge>
                        )}
                        {isOverdue && (
                          <span className="ml-auto flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                            <Clock className="h-2.5 w-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs font-medium">{r.subject}</div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                        <span>{r.date}</span>
                        {r.linkedDsr && (
                          <>
                            <span>·</span>
                            <span className="font-mono">DSR: {r.linkedDsr}</span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </PaneBody>
          </>
        }
        rightPane={<RfiInspector rfi={selected} onOpenDsr={onOpenDsr} />}
        leftPaneWidth="320px"
        rightPaneWidth="380px"
      />

      {/* Create RFI Modal — opened by the "+" button (audit D5-1) */}
      {createModalOpen && (
        <RfiCreateModal
          rfiId={createRfiId}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(newRfiId) => {
            setCreateModalOpen(false)
            setSelectedId(newRfiId)
          }}
        />
      )}
    </>
  )
}
