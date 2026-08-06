'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Package, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ReqItem, Tab } from './types'

// Human-readable label for each procurement tab — used by the "select an
// item" placeholder shown when the inspector is opened on a non-req tab.
const TAB_LABELS: Record<Tab, string> = {
  req: 'requisition',
  po: 'PO',
  grn: 'GRN',
  stock: 'stock item',
  min: 'MIN',
}

export function ProcurementInspector({
  tab,
  selectedId,
  reqs,
  onGeneratePos,
  onMarkFullyPod,
  onCancelReq,
  onApprove,
}: {
  tab: Tab
  selectedId: string
  reqs: ReqItem[]
  onGeneratePos?: () => void
  onMarkFullyPod?: (reqId: string) => void
  onCancelReq?: (reqId: string) => void
  onApprove?: (reqId: string) => void
}) {
  // The inspector only renders requisition details. The PO/GRN/Stock/MIN
  // tabs have their own list views in the center pane; showing requisition
  // data there is misleading (it would surface a requisition that has
  // nothing to do with the selected PO/GRN). Surface an honest placeholder
  // instead — the center pane already shows the row-level details for the
  // active tab.
  if (tab !== 'req') {
    return (
      <>
        <PaneHeader title="Inspector" />
        <PaneBody>
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-12 text-center text-xs">
            <Package className="h-6 w-6 opacity-40" />
            <div className="font-medium">No {TAB_LABELS[tab]} selected</div>
            <div className="text-[11px]">
              Select a {TAB_LABELS[tab]} item from the list to view details.
            </div>
          </div>
        </PaneBody>
      </>
    )
  }

  const req = reqs.find((r) => r.id === selectedId) ?? reqs[0]
  if (!req) return null
  return (
    <>
      <PaneHeader title="Inspector" />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="text-muted-foreground font-mono text-xs">{req.id}</div>
          <div className="mt-1 text-sm font-semibold">{req.item}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {req.qty} {req.uom} · Source: {req.source}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Line-Item Traceability
          </div>
          <div className="space-y-1.5 rounded-md border border-[var(--pane-divider)] p-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary" className="text-[10px]">
                {req.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendors compared</span>
              <span className="font-mono">{req.vendors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lowest bid</span>
              <span className="font-mono">
                {req.vendors.length > 0
                  ? `NPR ${Math.min(...req.vendors.map((v) => v.rate)).toLocaleString()}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected</span>
              <span className="font-mono font-medium">
                {req.vendors.find((v) => v.selected)?.name ?? '—'}
              </span>
            </div>
            {req.vendors.find((v) => v.selected) && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected rate</span>
                  <span className="font-mono">
                    NPR {req.vendors.find((v) => v.selected)!.rate.toLocaleString()} / {req.uom}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO value (est.)</span>
                  <span className="font-mono font-semibold">
                    NPR {(req.qty * req.vendors.find((v) => v.selected)!.rate).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {req.overrideReason && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                <ShieldAlert className="h-3 w-3" />
                Override justification on file
              </div>
              <div className="text-muted-foreground mt-1 italic">
                &quot;{req.overrideReason}&quot;
              </div>
              <div className="text-muted-foreground mt-1 text-[10px]">
                Audit trail available via the API.
              </div>
            </div>
          )}

          <Separator />

          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Linked Records
          </div>
          <div className="bg-secondary/20 text-muted-foreground space-y-1 rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
            <div>Linked records will appear here when:</div>
            <ul className="ml-3 list-disc space-y-0.5">
              <li>This requisition is linked to a BOQ item</li>
              <li>POs are generated from this requisition</li>
              <li>GRNs are received against those POs</li>
            </ul>
            <div className="pt-1">Use the Procurement module to track POs and GRNs.</div>
          </div>

          <Separator />

          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Actions
          </div>
          <div className="space-y-1.5">
            {req.status === 'Draft' && (
              <Button
                variant="default"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                onClick={() => onApprove?.(req.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve Requisition
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => {
                if (onGeneratePos) {
                  onGeneratePos()
                } else {
                  toast.info('Use the "Generate POs" button in the Requisitions center.')
                }
              }}
            >
              <Package className="h-3.5 w-3.5" />
              Convert to Consolidated PO
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => {
                if (onMarkFullyPod) {
                  onMarkFullyPod(req.id)
                }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Fully PO'd
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-8 w-full justify-start gap-2 text-xs"
              onClick={() => {
                if (onCancelReq) {
                  onCancelReq(req.id)
                }
              }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Cancel Requisition
            </Button>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
