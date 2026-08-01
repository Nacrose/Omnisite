'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trophy, AlertTriangle, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReqItem } from './types'

export function ReqCenterView({
  reqs,
  selectedId,
  onSelect,
  onVendorSelect,
  onGeneratePos,
}: {
  reqs: ReqItem[]
  selectedId: string
  onSelect: (id: string) => void
  onVendorSelect: (reqId: string, vendorName: string) => void
  onGeneratePos: () => void
}) {
  return (
    <>
      <div className="bg-secondary/20 text-muted-foreground border-b border-[var(--pane-divider)] px-4 py-3 text-xs">
        Selecting lowest bidder is automatic (🏆). Choosing a higher bidder requires justification.
        Click a vendor card to select.
      </div>
      <div className="space-y-3 p-3">
        {reqs.map((r) => {
          const lowest = Math.min(...r.vendors.map((v) => v.rate))
          const selectedVendor = r.vendors.find((v) => v.selected)
          const isOverride = selectedVendor && selectedVendor.rate > lowest
          return (
            <div
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                'cursor-pointer rounded-lg border p-3 transition-colors',
                selectedId === r.id
                  ? 'border-primary bg-accent/40'
                  : 'hover:border-primary/40 border-[var(--pane-divider)]'
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">{r.id}</span>
                <Badge variant="outline" className="text-[10px]">
                  {r.source}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px]',
                    r.status === "Fully PO'd" &&
                      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                    r.status === "Partially PO'd" &&
                      'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {r.status}
                </Badge>
                <span className="text-muted-foreground ml-auto text-xs">
                  {r.qty} {r.uom}
                </span>
              </div>
              <div className="text-sm font-medium">{r.item}</div>
              {/* Vendor matrix — now interactive */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {r.vendors.map((v, i) => {
                  const isLowest = v.rate === lowest
                  return (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation()
                        onVendorSelect(r.id, v.name)
                      }}
                      className={cn(
                        'rounded border p-2 text-left text-xs transition-all hover:shadow-sm',
                        v.selected
                          ? 'border-primary bg-primary/5 ring-primary/30 ring-1'
                          : 'hover:border-primary/40 hover:bg-accent/30 border-[var(--pane-divider)]',
                        isLowest && !v.selected && 'border-emerald-500/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{v.name}</span>
                        {isLowest && <Trophy className="h-3 w-3 flex-shrink-0 text-amber-500" />}
                      </div>
                      <div className="mt-0.5 font-mono">NPR {v.rate.toLocaleString()}</div>
                      {v.selected && (
                        <div className="text-primary mt-0.5 text-[9px] font-semibold">
                          ✓ Selected
                        </div>
                      )}
                      {isLowest && !v.selected && (
                        <div className="mt-0.5 text-[9px] text-emerald-600">Lowest bid</div>
                      )}
                    </button>
                  )
                })}
              </div>
              {isOverride && (
                <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
                  <div>
                    <span className="font-medium">Override justification on file:</span>
                    <span className="text-muted-foreground">
                      {' '}
                      NPR {(selectedVendor!.rate - lowest).toLocaleString()} above lowest. "
                      {r.overrideReason || 'Better delivery lead-time (3 days vs 7 days)'}"
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-secondary/20 border-t border-[var(--pane-divider)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Consolidated PO Builder</span>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onGeneratePos}>
            <Package className="h-3.5 w-3.5" />
            Generate POs
          </Button>
        </div>
        <div className="text-muted-foreground text-[11px]">
          {reqs.filter((r) => r.status === 'Approved' || r.status === "Partially PO'd").length}{' '}
          approved requisitions will be auto-grouped by vendor and merged into POs. Pushes
          "Committed Cost" to Financials.
        </div>
      </div>
    </>
  )
}
