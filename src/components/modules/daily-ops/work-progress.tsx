'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  Plus, Copy, Mail, Camera, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DsrEntry, StatusDot } from './types'

export function WorkProgressView({ entries, selectedId, onSelect }: {
  entries: DsrEntry[]; selectedId: string; onSelect: (id: string) => void
}) {
  const selected = entries.find(e => e.id === selectedId)
  // Stable ITR ID — generated once per mount so it doesn't change on every render.
  const [itrId] = useState(() => Math.floor(Math.random() * 9000) + 1000)
  return (
    <>
      <PaneHeader title="Work Progress · Auto-generated from Schedule">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Ad-Hoc Entry</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Copy className="w-3.5 h-3.5" />Copy Yesterday</Button>
      </PaneHeader>

      {/* ITR auto-prompt when selected entry is completed */}
      {selected?.status === 'completed' && (
        <div className="px-4 py-2 border-b border-[var(--pane-divider)] bg-emerald-500/10 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">ITR auto-prompted:</span>
            <span className="text-muted-foreground"> {selected.id} marked completed → Inspection Test Request ITR-{itrId} auto-generated for consultant approval.</span>
          </span>
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => toast.success('Opening ITR', { description: 'Redirecting to Q&S module' })}>
            View ITR
          </Button>
        </div>
      )}
      <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
        <div className="w-20 px-2">DSR #</div>
        <div className="flex-1 px-2">Task</div>
        <div className="w-32 px-2">Chainage</div>
        <div className="w-20 px-2 text-right">Planned</div>
        <div className="w-20 px-2 text-right">Actual</div>
        <div className="w-14 px-2">UOM</div>
        <div className="w-28 px-2">Status</div>
        <div className="w-12 px-2 text-center">Actions</div>
      </div>
      <PaneBody className="px-0">
        {entries.map(d => {
          const variance = d.actual - d.planned
          const variancePct = d.planned > 0 ? (variance / d.planned) * 100 : 0
          return (
            <div
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={cn(
                'flex items-center h-10 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover transition-colors',
                selectedId === d.id && 'bg-accent'
              )}
            >
              <div className="w-20 px-2 font-mono text-muted-foreground">{d.id}</div>
              <div className="flex-1 px-2 min-w-0">
                <div className="font-medium truncate">{d.task}</div>
                {d.remarks && <div className="text-[10px] text-muted-foreground truncate">{d.remarks}</div>}
              </div>
              <div className="w-32 px-2 font-mono text-[10px] text-muted-foreground truncate">{d.chainage}</div>
              <div className="w-20 px-2 text-right font-mono">{d.planned || '—'}</div>
              <div className={cn('w-20 px-2 text-right font-mono', variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : '')}>
                {d.actual || '—'}
                {d.planned > 0 && (
                  <span className="text-[9px] text-muted-foreground ml-0.5">({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)</span>
                )}
              </div>
              <div className="w-14 px-2 text-muted-foreground">{d.uom}</div>
              <div className="w-28 px-2"><StatusDot status={d.status} /></div>
              <div className="w-12 px-2 flex items-center gap-1 justify-center">
                {d.hasRfi && <Mail className="w-3 h-3 text-sky-500" />}
                {d.hasPhotos && <Camera className="w-3 h-3 text-violet-500" />}
                {!d.hasRfi && !d.hasPhotos && <span className="text-muted-foreground/30">—</span>}
              </div>
            </div>
          )
        })}
      </PaneBody>
    </>
  )
}
