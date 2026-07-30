'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Trophy, AlertTriangle, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReqItem } from './types'

export function ReqCenterView({ reqs, selectedId, onSelect, onVendorSelect, onGeneratePos }: {
  reqs: ReqItem[]; selectedId: string; onSelect: (id: string) => void; onVendorSelect: (reqId: string, vendorName: string) => void; onGeneratePos: () => void
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-[var(--pane-divider)] bg-secondary/20 text-xs text-muted-foreground">
        Selecting lowest bidder is automatic (🏆). Choosing a higher bidder requires justification. Click a vendor card to select.
      </div>
      <div className="space-y-3 p-3">
        {reqs.map(r => {
          const lowest = Math.min(...r.vendors.map(v => v.rate))
          const selectedVendor = r.vendors.find(v => v.selected)
          const isOverride = selectedVendor && selectedVendor.rate > lowest
          return (
            <div
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                'rounded-lg border p-3 cursor-pointer transition-colors',
                selectedId === r.id ? 'border-primary bg-accent/40' : 'border-[var(--pane-divider)] hover:border-primary/40'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-muted-foreground">{r.id}</span>
                <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                <Badge variant="secondary" className={cn('text-[10px]', r.status === 'Fully PO\'d' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', r.status === 'Partially PO\'d' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{r.status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{r.qty} {r.uom}</span>
              </div>
              <div className="font-medium text-sm">{r.item}</div>
              {/* Vendor matrix — now interactive */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {r.vendors.map((v, i) => {
                  const isLowest = v.rate === lowest
                  return (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); onVendorSelect(r.id, v.name) }}
                      className={cn(
                        'p-2 rounded border text-xs text-left transition-all hover:shadow-sm',
                        v.selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-[var(--pane-divider)] hover:border-primary/40 hover:bg-accent/30',
                        isLowest && !v.selected && 'border-emerald-500/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{v.name}</span>
                        {isLowest && <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      </div>
                      <div className="font-mono mt-0.5">NPR {v.rate.toLocaleString()}</div>
                      {v.selected && <div className="text-[9px] text-primary mt-0.5 font-semibold">✓ Selected</div>}
                      {isLowest && !v.selected && <div className="text-[9px] text-emerald-600 mt-0.5">Lowest bid</div>}
                    </button>
                  )
                })}
              </div>
              {isOverride && (
                <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Override justification on file:</span>
                    <span className="text-muted-foreground"> NPR {(selectedVendor!.rate - lowest).toLocaleString()} above lowest. "{r.overrideReason || 'Better delivery lead-time (3 days vs 7 days)'}"</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-[var(--pane-divider)] p-3 bg-secondary/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">Consolidated PO Builder</span>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onGeneratePos}><Package className="w-3.5 h-3.5" />Generate POs</Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {reqs.filter(r => r.status === 'Approved' || r.status === 'Partially PO\'d').length} approved requisitions will be auto-grouped by vendor and merged into POs. Pushes "Committed Cost" to Financials.
        </div>
      </div>
    </>
  )
}
