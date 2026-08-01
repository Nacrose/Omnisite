'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  FileText,
  Package,
  Truck,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'
import { ReqItem, Tab } from './types'

export function ProcurementInspector({
  tab,
  selectedId,
  reqs,
}: {
  tab: Tab
  selectedId: string
  reqs: ReqItem[]
}) {
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
              <Badge variant="secondary" className="text-[9px]">
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
                NPR {Math.min(...req.vendors.map((v) => v.rate)).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selected</span>
              <span className="font-mono font-medium">
                {req.vendors.find((v) => v.selected)?.name}
              </span>
            </div>
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
                Audit logged · 30 Jul 2026 14:32 · Engr.
              </div>
            </div>
          )}

          <Separator />

          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Linked Records
          </div>
          <div className="space-y-1.5 text-xs">
            <LinkRow
              icon={<FileText className="h-3 w-3" />}
              label="Schedule task"
              value="T-203 PCC M15 pouring"
            />
            <LinkRow
              icon={<Package className="h-3 w-3" />}
              label="Purchase Order"
              value="PO-2410-018 · NPR 1,104,000"
              status="ok"
            />
            <LinkRow
              icon={<Truck className="h-3 w-3" />}
              label="GRN"
              value="GRN-0089 · 1,200 bags received"
              status="ok"
            />
            <LinkRow
              icon={<TrendingUp className="h-3 w-3" />}
              label="Committed → Actual"
              value="NPR 1,104,000 → NPR 1,082,400"
            />
            <LinkRow
              icon={<MapPin className="h-3 w-3" />}
              label="Stock location"
              value="Main Store · Kalanki"
            />
          </div>

          <Separator />

          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Actions
          </div>
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs">
              <Package className="h-3.5 w-3.5" />
              Convert to Consolidated PO
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Fully PO'd
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-8 w-full justify-start gap-2 text-xs"
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

function LinkRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode
  label: string
  value: string
  status?: 'ok'
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-[10px]">{label}</div>
        <div className="truncate text-xs">{value}</div>
      </div>
      {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
    </div>
  )
}
