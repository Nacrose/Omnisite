'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Layers, Mountain, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'

// ─── Sub-BOQ Tab (composite + conditional items + mapping) ───────────────────

export function SubBoqTab({ sc }: { sc: Subcontractor }) {
  const compositeItems = sc.items.filter(i => i.type === 'composite')
  const conditionalItems = sc.items.filter(i => i.type === 'conditional')
  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)

  return (
    <div className="p-4 space-y-4 text-xs">
      {/* Earned value summary */}
      <div className="p-2.5 rounded-md bg-secondary/40">
        <div className="text-[10px] text-muted-foreground">Total Earned Value (SC BOQ actuals × SC rates)</div>
        <div className="text-lg font-bold mt-0.5 tabular-nums">{fmtNPR(earned)}</div>
      </div>

      {/* Composite items */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Composite Items ({compositeItems.length})
        </div>
        <div className="space-y-2">
          {compositeItems.map(it => {
            const earnedItem = it.actualQty * it.rate
            const progress = it.plannedQty > 0 ? (it.actualQty / it.plannedQty) * 100 : 0
            return (
              <div key={it.id} className="rounded-md border border-[var(--pane-divider)] overflow-hidden">
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{it.code}</span>
                    <Badge variant="outline" className="text-[9px]">{it.type}</Badge>
                  </div>
                  <div className="font-medium text-xs">{it.desc}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Rate: <span className="font-mono text-foreground">{fmtNPR(it.rate)}/{it.uom}</span></span>
                    <span>·</span>
                    <span>Planned: <span className="font-mono text-foreground">{it.plannedQty > 0 ? it.plannedQty : 'Variable'} {it.uom}</span></span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      {it.actualQty} / {it.plannedQty > 0 ? it.plannedQty : '?'} {it.uom}
                      {it.plannedQty > 0 && ` (${progress.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px]">
                    <span className="text-muted-foreground">Earned: <span className="font-mono font-medium text-foreground">{fmtNPR(earnedItem)}</span></span>
                  </div>
                </div>

                {/* Mapping table */}
                {it.mapping && it.mapping.length > 0 && (
                  <div className="border-t border-[var(--pane-divider)] bg-secondary/20 p-2.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Mapping → Main BOQ (coefficients per {it.uom})
                    </div>
                    <div className="space-y-1">
                      {it.mapping.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono text-muted-foreground w-12">{m.boqCode}</span>
                          <span className="flex-1 truncate">{m.boqDesc}</span>
                          <span className="font-mono text-muted-foreground">×{m.coefficient}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono font-medium w-16 text-right">{(m.coefficient * it.actualQty).toFixed(2)} {m.uom}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-[var(--pane-divider)] text-[9px] text-muted-foreground">
                      Derived BOQ quantities shown for {it.actualQty} {it.uom} actual completion
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Conditional items (tunneling) */}
      {conditionalItems.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mountain className="w-3 h-3" /> Conditional Support Items ({conditionalItems.length})
          </div>
          <div className="p-2 rounded-md bg-violet-500/10 border border-violet-500/30 text-[10px] text-muted-foreground mb-2">
            These items have 0 planned quantity — activated by face log entries. Payment is per actual installation.
          </div>
          <div className="space-y-1.5">
            {conditionalItems.map(it => {
              const earnedItem = it.actualQty * it.rate
              const designQty = it.designPattern ? it.designPattern * 42.5 : 0 // 42.5 = total rm advanced
              const variance = it.actualQty - designQty
              const variancePct = designQty > 0 ? (variance / designQty) * 100 : 0
              const overSupport = variance > 0
              return (
                <div key={it.id} className="rounded-md border border-[var(--pane-divider)] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{it.code}</span>
                    <Badge variant="secondary" className="text-[9px] bg-violet-500/15 text-violet-700 dark:text-violet-300">{it.rockClass}</Badge>
                  </div>
                  <div className="font-medium text-xs">{it.desc}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Rate: <span className="font-mono text-foreground">{fmtNPR(it.rate)}/{it.uom}</span></span>
                    <span>·</span>
                    <span>Design: <span className="font-mono text-foreground">{it.designPattern}/{it.uom}/rm</span></span>
                  </div>
                  {/* Variance row */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-1.5 rounded bg-secondary/40 text-center">
                      <div className="text-muted-foreground">Design Qty</div>
                      <div className="font-mono font-medium">{designQty.toFixed(1)} {it.uom}</div>
                    </div>
                    <div className="p-1.5 rounded bg-secondary/40 text-center">
                      <div className="text-muted-foreground">Actual</div>
                      <div className="font-mono font-medium">{it.actualQty} {it.uom}</div>
                    </div>
                    <div className={cn('p-1.5 rounded text-center', overSupport ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                      <div className="text-muted-foreground">Variance</div>
                      <div className={cn('font-mono font-bold', overSupport ? 'text-amber-600' : 'text-emerald-600')}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                  {overSupport && (
                    <div className="mt-1.5 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span>Over-support detected — RFI required for consultant approval before billing</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1.5 text-[10px]">
                    <span className="text-muted-foreground">Earned: <span className="font-mono font-medium text-foreground">{fmtNPR(earnedItem)}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => toast.info('Add SC BOQ Item', { description: 'Line-item picker will open here — coming soon.' })}><Plus className="w-3.5 h-3.5" />Add SC BOQ Item</Button>
    </div>
  )
}
