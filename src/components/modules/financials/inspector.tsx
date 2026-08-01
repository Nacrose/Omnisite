import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  AlertTriangle, FileSpreadsheet, Upload, Plus, Receipt, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, type CbsNode } from './types'

export function KpiCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-bold mt-0.5', muted && 'text-muted-foreground')}>{value}</div>
    </div>
  )
}

export function FinancialsInspector({ node }: { node: CbsNode }) {
  const systemEarned = node.actual * 1.04 // BCWP proxy
  const clientBilled = node.actual * 0.92 // upload&track value
  const unbilled = systemEarned - clientBilled

  return (
    <>
      <PaneHeader title={`Financial Inspector · ${node.code}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <Badge variant="outline" className="text-[10px]">CBS Node</Badge>
          <div className="text-sm font-semibold mt-2">{node.name}</div>
        </div>

        <Tabs defaultValue="pl">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 w-full text-xs">
              <TabsTrigger value="pl" className="text-[11px]">P&L</TabsTrigger>
              <TabsTrigger value="billing" className="text-[11px]">Client Billing</TabsTrigger>
              <TabsTrigger value="expenses" className="text-[11px]">Expenses</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pl" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <Row label="Budgeted Cost (BOQ)" value={`NPR ${fmt(node.budget)}`} />
            <Row label="Committed Cost (POs)" value={`NPR ${fmt(node.committed)}`} muted />
            <Row label="Actual Cost (DSR + Manual)" value={`NPR ${fmt(node.actual)}`} />
            <Row label="Forecast (EAC)" value={`NPR ${fmt(node.forecast)}`} bold />
            <Separator />
            <Row label="Variance (Budget − Forecast)" value={`NPR ${fmt(node.budget - node.forecast)}`} className={node.budget - node.forecast >= 0 ? 'delta-up' : 'delta-down'} />
            <Row label="Node Margin" value={`${node.marginPct >= 0 ? '+' : ''}${node.marginPct.toFixed(1)}%`} className={node.marginPct >= 0 ? 'delta-up' : 'delta-down'} bold />

            <Separator />

            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cost Composition (Actual)</div>
            <div className="space-y-1.5">
              <CostBar label="Material" amount={node.actual * 0.58} color="bg-blue-500" total={node.actual} />
              <CostBar label="Labour" amount={node.actual * 0.22} color="bg-emerald-500" total={node.actual} />
              <CostBar label="Equipment" amount={node.actual * 0.12} color="bg-amber-500" total={node.actual} />
              <CostBar label="Subcontractor" amount={node.actual * 0.05} color="bg-violet-500" total={node.actual} />
              <CostBar label="Indirect / O&P" amount={node.actual * 0.03} color="bg-rose-500" total={node.actual} />
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upload & Track Model</div>
            <div className="rounded-md border border-[var(--pane-divider)] p-3 bg-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">RA Bill #4 — Approved</span>
                <Badge variant="secondary" className="text-[9px] ml-auto">12 Aug 2026</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">Gross Billed Amount (manual input):</div>
              <Input className="mt-1 h-8 text-xs font-mono" defaultValue={`NPR ${fmt(clientBilled)}`} />
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1.5 w-full"><Upload className="w-3 h-3" />Re-upload Excel/PDF</Button>
            </div>

            <Separator />

            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System Reconciliation</div>
            <Row label="System Earned Value (BCWP)" value={`NPR ${fmt(systemEarned)}`} />
            <Row label="Uploaded Gross Billed" value={`NPR ${fmt(clientBilled)}`} muted />
            <Separator />
            <div className={cn('flex items-center gap-2 p-2 rounded-md', unbilled > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30')}>
              <AlertTriangle className={cn('w-3.5 h-3.5', unbilled > 0 ? 'text-amber-500' : 'text-emerald-500')} />
              <div className="flex-1">
                <div className="font-medium">{unbilled > 0 ? 'Unbilled Work Detected' : 'Reconciled'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {unbilled > 0 ? `NPR ${fmt(unbilled)} earned but not yet billed. Risk of revenue leakage.` : 'Billed matches earned value.'}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-0 px-4 py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Expense Entries</div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="w-3 h-3" />Add</Button>
            </div>
            {[
              { date: '29 Jul', desc: 'Site engineer salary — July', amount: 45000, cat: 'Salary' },
              { date: '28 Jul', desc: 'Fuel — site vehicle (receipt)', amount: 8200, cat: 'Travel' },
              { date: '27 Jul', desc: 'Survey equipment rental', amount: 12500, cat: 'T&P' },
              { date: '25 Jul', desc: 'Workshop — concrete testing', amount: 4500, cat: 'Quality' },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.desc}</div>
                  <div className="text-[10px] text-muted-foreground">{e.date} · {e.cat}</div>
                </div>
                <div className="font-mono">NPR {e.amount.toLocaleString()}</div>
                <Camera className="w-3 h-3 text-violet-500" />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

export function Row({ label, value, muted, bold, className }: { label: string; value: string; muted?: boolean; bold?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-bold', className)}>{value}</span>
    </div>
  )
}

export function CostBar({ label, amount, color, total }: { label: string; amount: number; color: string; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span>{label}</span>
        <span className="font-mono">NPR {fmt(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
