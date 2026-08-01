'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'
import {
  useColumnVisibility, ColumnToggle, StickyTableShell, StickyTableHeader, StickyTableBody, type ColumnDef,
} from '@/components/ui/table-utils'

// ─── Consumables Tab ─────────────────────────────────────────────────────────

export function ConsumablesTab({ sc }: { sc: Subcontractor }) {
  const COLS: ColumnDef[] = [
    { key: 'item', label: 'Consumable' },
    { key: 'issued', label: 'Issued' },
    { key: 'norm', label: 'Norm' },
    { key: 'theoretical', label: 'Theoretical' },
    { key: 'variance', label: 'Variance' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(COLS.map(c => c.key), [], 'sc-consumables')
  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Consumables Tracking (norm-based chargeback)
      </div>

      <div className="rounded-md border border-[var(--pane-divider)]">
        <StickyTableShell minWidth={660}>
          <StickyTableHeader>
            {isVisible('item') && <div className="w-44 px-2">Consumable</div>}
            {isVisible('issued') && <div className="w-24 px-2 text-right">Issued</div>}
            {isVisible('norm') && <div className="w-24 px-2 text-right">Norm</div>}
            {isVisible('theoretical') && <div className="w-24 px-2 text-right">Theoretical</div>}
            {isVisible('variance') && <div className="w-24 px-2 text-right">Variance</div>}
            <div className="flex-shrink-0 pr-2"><ColumnToggle columns={COLS} visible={visible} onToggle={toggle} /></div>
          </StickyTableHeader>
          <StickyTableBody>
            {sc.consumables.map(c => {
              const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
              const variance = c.qty - theoretical
              const variancePct = theoretical > 0 ? (variance / theoretical) * 100 : 0
              const overNorm = variance > 0
              return (
                <div key={c.id} className="flex items-center px-2 py-1.5 border-t border-[var(--pane-divider)]">
                  {isVisible('item') && (
                    <div className="w-44 px-2 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[9px] text-muted-foreground">{c.date} · {fmtNPR(c.rate)}/{c.uom}</div>
                    </div>
                  )}
                  {isVisible('issued') && <div className="w-24 px-2 text-right font-mono">{c.qty} {c.uom}</div>}
                  {isVisible('norm') && (
                    <div className="w-24 px-2 text-right font-mono text-muted-foreground">
                      {c.normPerUnit ? `${c.normPerUnit}/${c.normUnit}` : '—'}
                    </div>
                  )}
                  {isVisible('theoretical') && (
                    <div className="w-24 px-2 text-right font-mono text-muted-foreground">
                      {theoretical > 0 ? `${theoretical.toFixed(1)} ${c.uom}` : '—'}
                    </div>
                  )}
                  {isVisible('variance') && (
                    <div className={cn('w-24 px-2 text-right font-mono font-medium', overNorm ? 'text-amber-600' : 'text-emerald-600')}>
                      {variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)
                    </div>
                  )}
                </div>
              )
            })}
          </StickyTableBody>
        </StickyTableShell>
      </div>

      <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] text-muted-foreground">
        Over-norm consumption is charged back to the SC at cost. E.g., if binding wire norm is 0.5 kg/MT and SC used 6.5 kg for 12.5 MT (norm = 6.25 kg), the extra 0.25 kg is charged.
      </div>

      {/* Chargeback summary */}
      <div className="p-2.5 rounded-md bg-secondary/40">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Chargeback Summary</div>
        {(() => {
          let totalChargeback = 0
          sc.consumables.forEach(c => {
            const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
            const overQty = Math.max(0, c.qty - theoretical)
            totalChargeback += overQty * c.rate
          })
          return (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total over-norm chargeback</span>
              <span className="font-mono font-bold text-amber-600">{fmtNPR(totalChargeback)}</span>
            </div>
          )
        })()}
      </div>

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Plus className="w-3.5 h-3.5" />Add Consumable Issue</Button>
    </div>
  )
}
