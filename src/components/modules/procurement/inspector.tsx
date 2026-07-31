'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  FileText, Package, Truck, TrendingUp, MapPin, CheckCircle2,
  AlertTriangle, ShieldAlert,
} from 'lucide-react'
import { ReqItem, Tab } from './types'

export function ProcurementInspector({ tab, selectedId, reqs }: { tab: Tab; selectedId: string; reqs: ReqItem[] }) {
  const req = reqs.find(r => r.id === selectedId) ?? reqs[0]
  if (!req) return null
  return (
    <>
      <PaneHeader title="Inspector" />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="font-mono text-xs text-muted-foreground">{req.id}</div>
          <div className="text-sm font-semibold mt-1">{req.item}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{req.qty} {req.uom} · Source: {req.source}</div>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Line-Item Traceability</div>
          <div className="p-2.5 rounded-md border border-[var(--pane-divider)] space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary" className="text-[9px]">{req.status}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vendors compared</span><span className="font-mono">{req.vendors.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lowest bid</span><span className="font-mono">NPR {Math.min(...req.vendors.map(v => v.rate)).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Selected</span><span className="font-mono font-medium">{req.vendors.find(v => v.selected)?.name}</span></div>
          </div>

          {req.overrideReason && (
            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px]">
              <div className="font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <ShieldAlert className="w-3 h-3" />Override justification on file
              </div>
              <div className="text-muted-foreground mt-1 italic">&quot;{req.overrideReason}&quot;</div>
              <div className="text-[10px] text-muted-foreground mt-1">Audit logged · 30 Jul 2026 14:32 · Arjun S.</div>
            </div>
          )}

          <Separator />

          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Records</div>
          <div className="space-y-1.5 text-xs">
            <LinkRow icon={<FileText className="w-3 h-3" />} label="Schedule task" value="T-203 PCC M15 pouring" />
            <LinkRow icon={<Package className="w-3 h-3" />} label="Purchase Order" value="PO-2410-018 · NPR 1,104,000" status="ok" />
            <LinkRow icon={<Truck className="w-3 h-3" />} label="GRN" value="GRN-0089 · 1,200 bags received" status="ok" />
            <LinkRow icon={<TrendingUp className="w-3 h-3" />} label="Committed → Actual" value="NPR 1,104,000 → NPR 1,082,400" />
            <LinkRow icon={<MapPin className="w-3 h-3" />} label="Stock location" value="Main Store · Kalanki" />
          </div>

          <Separator />

          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</div>
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Package className="w-3.5 h-3.5" />Convert to Consolidated PO</Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><CheckCircle2 className="w-3.5 h-3.5" />Mark Fully PO'd</Button>
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs justify-start gap-2 text-destructive"><AlertTriangle className="w-3.5 h-3.5" />Cancel Requisition</Button>
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function LinkRow({ icon, label, value, status }: { icon: React.ReactNode; label: string; value: string; status?: 'ok' }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-xs truncate">{value}</div>
      </div>
      {status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
    </div>
  )
}
