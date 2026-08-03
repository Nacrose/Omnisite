'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Plus, Copy, Mail, Camera, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DsrEntry, StatusDot } from './types'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

export function WorkProgressView({
  entries,
  selectedId,
  onSelect,
  onAddAdHoc,
  onCopyYesterday,
}: {
  entries: DsrEntry[]
  selectedId: string
  onSelect: (id: string) => void
  /** Fired when the user clicks "Ad-Hoc Entry". The parent adds a new DSR
   *  entry to the synced store. Previously this button had no onClick (audit D1-4). */
  onAddAdHoc?: () => void
  /** Fired when the user clicks "Copy Yesterday". The parent copies entries
   *  from the previous day. Previously this button had no onClick (audit D1-4). */
  onCopyYesterday?: () => void
}) {
  const selected = entries.find((e) => e.id === selectedId)
  // Track which entry's ITR banner the user has dismissed so it doesn't
  // reappear on every selection. Resets when the selected entry changes
  // (audit D3-5 — previously the banner persisted every time a completed
  // entry was selected, with no way to dismiss it).
  const [dismissedItrFor, setDismissedItrFor] = useState<string | null>(null)
  const showItrBanner = selected?.status === 'completed' && dismissedItrFor !== selected?.id
  // Stable ITR ID — generated once per mount using crypto.randomUUID() so it
  // doesn't change on re-render and isn't based on Math.random() (which could
  // collide across mounts). The displayed ITR uses the first 8 hex chars so
  // it stays compact while remaining unique.
  const [itrId] = useState(() => crypto.randomUUID().slice(0, 8))
  const router = useRouter()
  const COLS: ColumnDef[] = [
    { key: 'dsr', label: 'DSR #' },
    { key: 'task', label: 'Task' },
    { key: 'chainage', label: 'Chainage' },
    { key: 'planned', label: 'Planned' },
    { key: 'actual', label: 'Actual' },
    { key: 'uom', label: 'UOM' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'work-progress'
  )
  return (
    <>
      <PaneHeader title="Work Progress · Auto-generated from Schedule">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            if (onAddAdHoc) {
              onAddAdHoc()
            } else {
              toast.info('Ad-hoc entry coming soon', {
                description: 'Will add a new DSR entry for the selected date.',
              })
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Ad-Hoc Entry
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            if (onCopyYesterday) {
              onCopyYesterday()
            } else {
              toast.info('Copy Yesterday coming soon', {
                description: 'Will prefill from the previous day’s entries.',
              })
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Yesterday
        </Button>
      </PaneHeader>

      {/* ITR auto-prompt when selected entry is completed (dismissible) */}
      {showItrBanner && selected && (
        <div className="flex items-center gap-2 border-b border-[var(--pane-divider)] bg-emerald-500/10 px-4 py-2 text-xs">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span className="flex-1">
            <span className="font-medium">ITR auto-prompted:</span>
            <span className="text-muted-foreground">
              {' '}
              {selected.id} marked completed → Inspection Test Request ITR-{itrId} auto-generated
              for consultant approval.
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-[10px]"
            onClick={() => router.push('/qs')}
          >
            View ITR
          </Button>
          <button
            onClick={() => setDismissedItrFor(selected.id)}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 text-[10px]"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <StickyTableShell minWidth={840}>
        <StickyTableHeader>
          {isVisible('dsr') && <div className="w-20 px-2">DSR #</div>}
          {isVisible('task') && <div className="flex-1 px-2">Task</div>}
          {isVisible('chainage') && <div className="w-32 px-2">Chainage</div>}
          {isVisible('planned') && <div className="w-20 px-2 text-right">Planned</div>}
          {isVisible('actual') && <div className="w-20 px-2 text-right">Actual</div>}
          {isVisible('uom') && <div className="w-14 px-2">UOM</div>}
          {isVisible('status') && <div className="w-28 px-2">Status</div>}
          {isVisible('actions') && <div className="w-12 px-2 text-center">Actions</div>}
          <div className="flex-shrink-0 pr-2">
            <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
          </div>
        </StickyTableHeader>
        <StickyTableBody>
          {entries.map((d) => {
            const variance = d.actual - d.planned
            const variancePct = d.planned > 0 ? (variance / d.planned) * 100 : 0
            return (
              <div
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={cn(
                  'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
                  selectedId === d.id && 'bg-accent'
                )}
              >
                {isVisible('dsr') && (
                  <div className="text-muted-foreground w-20 px-2 font-mono">{d.id}</div>
                )}
                {isVisible('task') && (
                  <div className="min-w-0 flex-1 px-2">
                    <div className="truncate font-medium">{d.task}</div>
                    {d.remarks && (
                      <div className="text-muted-foreground truncate text-[10px]">{d.remarks}</div>
                    )}
                  </div>
                )}
                {isVisible('chainage') && (
                  <div className="text-muted-foreground w-32 truncate px-2 font-mono text-[10px]">
                    {d.chainage}
                  </div>
                )}
                {isVisible('planned') && (
                  <div className="w-20 px-2 text-right font-mono">{d.planned || '—'}</div>
                )}
                {isVisible('actual') && (
                  <div
                    className={cn(
                      'w-20 px-2 text-right font-mono',
                      variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : ''
                    )}
                  >
                    {d.actual || '—'}
                    {d.planned > 0 && (
                      <span className="text-muted-foreground ml-0.5 text-[9px]">
                        ({variancePct >= 0 ? '+' : ''}
                        {variancePct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}
                {isVisible('uom') && <div className="text-muted-foreground w-14 px-2">{d.uom}</div>}
                {isVisible('status') && (
                  <div className="w-28 px-2">
                    <StatusDot status={d.status} />
                  </div>
                )}
                {isVisible('actions') && (
                  <div className="flex w-12 items-center justify-center gap-1 px-2">
                    {d.hasRfi && <Mail className="h-3 w-3 text-sky-500" />}
                    {d.hasPhotos && <Camera className="h-3 w-3 text-violet-500" />}
                    {!d.hasRfi && !d.hasPhotos && (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </StickyTableBody>
      </StickyTableShell>
    </>
  )
}
