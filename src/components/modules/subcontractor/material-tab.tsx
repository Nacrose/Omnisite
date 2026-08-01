'use client'

import { Button } from '@/components/ui/button'
import { Plus, Package, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'

// ─── Material Reconciliation Tab ─────────────────────────────────────────────

export function MaterialTab({ sc }: { sc: Subcontractor }) {
  // Aggregate by material
  const materialMap = new Map<string, {
    code: string; name: string; uom: string; rate: number;
    issued: number; returned: number; theoretical: number;
  }>()

  // Sum issued
  for (const mi of sc.materialIssues) {
    const key = mi.materialCode
    const existing = materialMap.get(key) || { code: mi.materialCode, name: mi.materialName, uom: mi.uom, rate: mi.rate, issued: 0, returned: 0, theoretical: 0 }
    existing.issued += mi.qty
    materialMap.set(key, existing)
  }
  // Sum returns
  for (const mr of sc.materialReturns) {
    const key = mr.materialCode
    const existing = materialMap.get(key)
    if (existing) existing.returned += mr.qty
  }
  // Calculate theoretical from composite items mapping × RA coefficients.
  // Drain SC: cement = 5.7 bags/rmt, steel = 0.095 mt/rmt, agg = 0.9 cum/rmt, sand = 0.45 cum/rmt.
  // Tunneling SC: shotcrete, rockbolts, steel ribs have their own norms.
  const totalRmt = sc.items.find(i => i.type === 'composite')?.actualQty || 0
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC') {
      // PCC: 0.40 cum/rmt × 4.5 bags + RCC: 0.60 cum/rmt × 6.5 bags = 5.7 bags/rmt
      m.theoretical = totalRmt * 5.7
    } else if (m.code === 'M-STEEL-TMT16' || m.code === 'M-STEEL-ISMB150') {
      // Drain: rebar ~0.095 mt/rmt. Tunnel: steel ribs ~0.83 rib/rmt (handled below).
      m.theoretical = totalRmt * 0.095
    } else if (m.code === 'M-AGG-20') {
      m.theoretical = totalRmt * (0.40 * 0.9 + 0.60 * 0.9) // PCC + RCC agg
    } else if (m.code === 'M-SAND-R') {
      m.theoretical = totalRmt * (0.40 * 0.45 + 0.60 * 0.45)
    } else if (sc.isTunneling) {
      // Tunneling-specific materials not covered by the drain coefficients.
      // Use designPattern from the SC's conditional items when available;
      // otherwise leave theoretical at 0 and the UI will show 'N/A'.
      if (m.code === 'M-SHOTCRETE') {
        const pattern = sc.items.find(i => i.code === 'SC-TUN-SHOT')?.designPattern
        m.theoretical = pattern ? pattern * totalRmt : 0
      } else if (m.code === 'M-ROCKBOLT3') {
        const pattern = sc.items.find(i => i.code === 'SC-TUN-BOLT')?.designPattern
        m.theoretical = pattern ? pattern * totalRmt : 0
      } else if (m.code === 'M-STEEL-ISMB150' && sc.isTunneling) {
        // Tunnel steel rib: ~0.83 rib/rmt × ~0.045 mt/rib = 0.037 mt/rmt
        m.theoretical = totalRmt * 0.037
      }
    }
  }

  const materials = Array.from(materialMap.values())

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Material Issue & Reconciliation
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Total Issued</div>
          <div className="text-sm font-bold">{sc.materialIssues.length} MINs</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Total Returns</div>
          <div className="text-sm font-bold">{sc.materialReturns.length} MRNs</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Materials Tracked</div>
          <div className="text-sm font-bold">{materials.length}</div>
        </div>
      </div>

      {/* Reconciliation table */}
      <div className="rounded-md border border-[var(--pane-divider)] overflow-hidden">
        <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-secondary/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Material</div>
          <div className="col-span-2 text-right">Theoretical</div>
          <div className="col-span-2 text-right">Issued</div>
          <div className="col-span-1 text-right">Ret.</div>
          <div className="col-span-2 text-right">Net Used</div>
          <div className="col-span-1 text-right">Var%</div>
        </div>
        {materials.map(m => {
          const netUsed = m.issued - m.returned
          const hasTheoretical = m.theoretical > 0
          const variance = hasTheoretical ? ((netUsed - m.theoretical) / m.theoretical) * 100 : 0
          const overVariance = hasTheoretical && Math.abs(variance) > 5
          return (
            <div key={m.code} className={cn('grid grid-cols-12 gap-1 px-2 py-1.5 border-t border-[var(--pane-divider)]', overVariance && 'bg-amber-500/5')}>
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-[9px] text-muted-foreground font-mono">{m.code}</div>
              </div>
              <div className="col-span-2 text-right font-mono text-muted-foreground">
                {hasTheoretical ? `${m.theoretical.toFixed(1)} ${m.uom}` : <span className="text-[9px] opacity-60">N/A</span>}
              </div>
              <div className="col-span-2 text-right font-mono">{m.issued.toFixed(1)}</div>
              <div className="col-span-1 text-right font-mono text-muted-foreground">{m.returned.toFixed(0)}</div>
              <div className="col-span-2 text-right font-mono font-medium">{netUsed.toFixed(1)}</div>
              <div className={cn('col-span-1 text-right font-mono font-bold', overVariance ? 'text-amber-600' : hasTheoretical ? 'text-emerald-600' : 'text-muted-foreground/50')}>
                {hasTheoretical ? `${variance >= 0 ? '+' : ''}${variance.toFixed(0)}%` : '—'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-[10px] text-muted-foreground">
        Theoretical = mapped BOQ qty × RA coefficient. Net Used = Issued − Returned. Variance &gt;5% is flagged for chargeback.
      </div>

      {/* Issue register */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Material Issue Notes (MIN)</div>
        <div className="space-y-1.5">
          {sc.materialIssues.map(mi => (
            <div key={mi.id} className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
              <Package className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{mi.id}</span>
                  <span className="text-[10px] text-muted-foreground">{mi.date}</span>
                  <span className="text-[10px]">{mi.materialName}</span>
                </div>
              </div>
              <span className="font-mono text-[10px]">{mi.qty} {mi.uom}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{fmtNPR(mi.qty * mi.rate)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Returns */}
      {sc.materialReturns.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Material Return Notes (MRN)</div>
          <div className="space-y-1.5">
            {sc.materialReturns.map(mr => (
              <div key={mr.id} className="flex items-center gap-2 p-1.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                <ArrowLeft className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{mr.id}</span>
                    <span className="text-[10px] text-muted-foreground">{mr.date}</span>
                    <span className="text-[10px]">{mr.materialName}</span>
                  </div>
                  {mr.notes && <div className="text-[9px] text-muted-foreground truncate">{mr.notes}</div>}
                </div>
                <span className="font-mono text-[10px]">{mr.qty} {mr.uom}</span>
                <span className="font-mono text-[10px] text-emerald-600">−{fmtNPR(mr.qty * mr.rate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => toast.info('Issue Material to SC', { description: 'Material Issue Note (MIN) form will open here — coming soon.' })}><Plus className="w-3.5 h-3.5" />Issue Material to SC</Button>
    </div>
  )
}
