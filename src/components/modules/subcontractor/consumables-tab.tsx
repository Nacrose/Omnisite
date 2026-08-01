'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
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
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'sc-consumables'
  )
  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
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
            <div className="flex-shrink-0 pr-2">
              <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
            </div>
          </StickyTableHeader>
          <StickyTableBody>
            {sc.consumables.map((c) => {
              const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
              const variance = c.qty - theoretical
              const variancePct = theoretical > 0 ? (variance / theoretical) * 100 : 0
              const overNorm = variance > 0
              return (
                <div
                  key={c.id}
                  className="flex items-center border-t border-[var(--pane-divider)] px-2 py-1.5"
                >
                  {isVisible('item') && (
                    <div className="w-44 min-w-0 px-2">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-muted-foreground text-[9px]">
                        {c.date} · {fmtNPR(c.rate)}/{c.uom}
                      </div>
                    </div>
                  )}
                  {isVisible('issued') && (
                    <div className="w-24 px-2 text-right font-mono">
                      {c.qty} {c.uom}
                    </div>
                  )}
                  {isVisible('norm') && (
                    <div className="text-muted-foreground w-24 px-2 text-right font-mono">
                      {c.normPerUnit ? `${c.normPerUnit}/${c.normUnit}` : '—'}
                    </div>
                  )}
                  {isVisible('theoretical') && (
                    <div className="text-muted-foreground w-24 px-2 text-right font-mono">
                      {theoretical > 0 ? `${theoretical.toFixed(1)} ${c.uom}` : '—'}
                    </div>
                  )}
                  {isVisible('variance') && (
                    <div
                      className={cn(
                        'w-24 px-2 text-right font-mono font-medium',
                        overNorm ? 'text-amber-600' : 'text-emerald-600'
                      )}
                    >
                      {variance >= 0 ? '+' : ''}
                      {variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}
                      {variancePct.toFixed(0)}%)
                    </div>
                  )}
                </div>
              )
            })}
          </StickyTableBody>
        </StickyTableShell>
      </div>

      <div className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px]">
        Over-norm consumption is charged back to the SC at cost. E.g., if binding wire norm is 0.5
        kg/MT and SC used 6.5 kg for 12.5 MT (norm = 6.25 kg), the extra 0.25 kg is charged.
      </div>

      {/* Chargeback summary */}
      <div className="bg-secondary/40 rounded-md p-2.5">
        <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
          Chargeback Summary
        </div>
        {(() => {
          let totalChargeback = 0
          sc.consumables.forEach((c) => {
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

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        disabled
        title="Coming soon"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Consumable Issue
      </Button>
    </div>
  )
}
