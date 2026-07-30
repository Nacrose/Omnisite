'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Search, Plus, Trophy, AlertTriangle, CheckCircle2, Package, FileText,
  Truck, Boxes, ArrowRight, Layers, MapPin, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'req' | 'po' | 'grn' | 'stock' | 'min'

interface ReqItem {
  id: string; item: string; uom: string; qty: number;
  vendors: { name: string; rate: number; selected?: boolean }[];
  status: 'Draft' | 'Approved' | 'Partially PO\'d' | 'Fully PO\'d';
  source: 'Sched' | 'Manual'
}

const REQS: ReqItem[] = [
  {
    id: 'REQ-0142', item: 'Cement OPC 53 Grade', uom: 'Bag', qty: 1200, status: 'Approved', source: 'Sched',
    vendors: [
      { name: 'Udaipur Cement', rate: 920, selected: true },
      { name: 'Shivam Cement', rate: 935 },
      { name: 'Hongshi Cement', rate: 918 },
    ],
  },
  {
    id: 'REQ-0143', item: 'TMT Steel Fe500 16mm', uom: 'MT', qty: 8.5, status: 'Partially PO\'d', source: 'Manual',
    vendors: [
      { name: 'Pashupati Steel', rate: 118200, selected: true },
      { name: 'Hama Steel', rate: 119000 },
    ],
  },
  {
    id: 'REQ-0144', item: 'Shuttering Ply 18mm', uom: 'Sheet', qty: 60, status: 'Draft', source: 'Sched',
    vendors: [
      { name: 'Ghorahi Ply', rate: 2850 },
      { name: 'Ganapati Ply', rate: 2790, selected: true },
    ],
  },
]

const POS = [
  { id: 'PO-2410-018', vendor: 'Udaipur Cement', date: '12 Aug 2026', value: 1104000, status: 'Delivered', items: 1, grn: true },
  { id: 'PO-2410-014', vendor: 'Trishuli Sand Suppliers', date: '08 Aug 2026', value: 173250, status: 'Partial', items: 2, grn: true },
  { id: 'PO-2410-022', vendor: 'Hetauda Aggregates', date: '15 Aug 2026', value: 285600, status: 'Pending', items: 3, grn: false },
]

const STOCK = [
  { code: 'M-CEM-OPC', name: 'Cement OPC 53 (Bag)', onHand: 1240, reserved: 480, available: 760, avgCost: 918, warehouse: 'Main Store · Kalanki' },
  { code: 'M-SAND-R', name: 'River Sand (cum)', onHand: 38.5, reserved: 12, available: 26.5, avgCost: 3850, warehouse: 'Site Stockpile' },
  { code: 'M-AGG-20', name: 'Coarse Agg 20mm (cum)', onHand: 64.2, reserved: 28, available: 36.2, avgCost: 2950, warehouse: 'Site Stockpile' },
  { code: 'M-STEEL-TMT16', name: 'TMT Steel 16mm (MT)', onHand: 4.8, reserved: 3.2, available: 1.6, avgCost: 118200, warehouse: 'Rebar Yard' },
  { code: 'M-PLY-18', name: 'Shuttering Ply 18mm (Sheet)', onHand: 48, reserved: 24, available: 24, avgCost: 2790, warehouse: 'Formwork Yard' },
]

export function ProcurementModule() {
  const [tab, setTab] = useState<Tab>('req')
  const [selectedId, setSelectedId] = useState('REQ-0142')

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Procurement">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="py-2">
            {([
              { id: 'req', name: 'Requisitions', count: 3, icon: FileText },
              { id: 'po', name: 'Purchase Orders', count: 12, icon: Package },
              { id: 'grn', name: 'GRN / 3-Way Match', count: 4, icon: CheckCircle2 },
              { id: 'stock', name: 'Live Stock', count: 5, icon: Boxes },
              { id: 'min', name: 'Material Issues (MIN)', count: 8, icon: ArrowRight },
            ] as { id: Tab; name: string; count: number; icon: typeof FileText }[]).map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 h-9 px-4 text-xs transition-colors',
                    tab === t.id ? 'bg-accent border-l-2 border-primary' : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left">{t.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{t.count}</Badge>
                </button>
              )
            })}
          </div>
          <div className="mt-auto border-t border-[var(--pane-divider)] p-3 space-y-1 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Procurement Snapshot</div>
            <div className="flex justify-between"><span className="text-muted-foreground">Open POs</span><span className="font-mono">12</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Committed cost</span><span className="font-mono">NPR 18.4M</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Stock value</span><span className="font-mono">NPR 1.92M</span></div>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={tab === 'req' ? 'Requisitions & Comparative Statement' : tab === 'po' ? 'Purchase Orders' : tab === 'grn' ? 'GRN & 3-Way Match' : tab === 'stock' ? 'Live Stock Dashboard' : 'Material Issue Notes'}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Search className="w-3.5 h-3.5" />Search</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />New {tab === 'req' ? 'Requisition' : tab === 'po' ? 'Consolidated PO' : tab === 'grn' ? 'GRN' : tab === 'stock' ? 'Material' : 'MIN'}</Button>
          </PaneHeader>

          {tab === 'req' && (
            <ReqCenterView selectedId={selectedId} onSelect={setSelectedId} />
          )}
          {tab === 'po' && <PoCenterView />}
          {tab === 'grn' && <GrnCenterView />}
          {tab === 'stock' && <StockCenterView />}
          {tab === 'min' && <MinCenterView />}
        </>
      }
      rightPane={<ProcurementInspector tab={tab} selectedId={selectedId} />}
      leftPaneWidth="260px"
      rightPaneWidth="380px"
    />
  )
}

function ReqCenterView({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="px-4 py-3 border-b border-[var(--pane-divider)] bg-secondary/20 text-xs text-muted-foreground">
        Selecting lowest bidder is automatic (🏆). Choosing a higher bidder requires justification.
      </div>
      <div className="space-y-3 p-3">
        {REQS.map(r => {
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
              {/* Vendor matrix */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {r.vendors.map((v, i) => {
                  const isLowest = v.rate === lowest
                  return (
                    <div key={i} className={cn(
                      'p-2 rounded border text-xs',
                      v.selected ? 'border-primary bg-primary/5' : 'border-[var(--pane-divider)]',
                      isLowest && !v.selected && 'border-emerald-500/40'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{v.name}</span>
                        {isLowest && <Trophy className="w-3 h-3 text-amber-500" />}
                      </div>
                      <div className="font-mono mt-0.5">NPR {v.rate.toLocaleString()}</div>
                      {v.selected && <div className="text-[9px] text-primary mt-0.5">✓ Selected</div>}
                    </div>
                  )
                })}
              </div>
              {isOverride && (
                <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Override justification required:</span>
                    <span className="text-muted-foreground"> Selected vendor is NPR {(selectedVendor!.rate - lowest).toLocaleString()} above lowest. Reason: "Better delivery lead-time (3 days vs 7 days)".</span>
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
          <Button size="sm" className="h-7 text-xs gap-1.5"><Package className="w-3.5 h-3.5" />Generate 3 POs</Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          3 approved requisitions will be auto-grouped by vendor and merged into 3 POs (dedup of duplicate materials applied). Pushes "Committed Cost" to Financials.
        </div>
      </div>
    </>
  )
}

function PoCenterView() {
  return (
    <PaneBody className="px-0">
      <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
        <div className="w-32 px-2">PO #</div>
        <div className="flex-1 px-2">Vendor</div>
        <div className="w-24 px-2">Date</div>
        <div className="w-16 px-2 text-center">Items</div>
        <div className="w-28 px-2 text-right">Value (NPR)</div>
        <div className="w-24 px-2">Status</div>
        <div className="w-16 px-2 text-center">GRN</div>
      </div>
      {POS.map(p => (
        <div key={p.id} className="flex items-center h-10 border-b border-[var(--pane-divider)] text-xs row-hover cursor-pointer">
          <div className="w-32 px-2 font-mono">{p.id}</div>
          <div className="flex-1 px-2 font-medium truncate">{p.vendor}</div>
          <div className="w-24 px-2 text-muted-foreground">{p.date}</div>
          <div className="w-16 px-2 text-center">{p.items}</div>
          <div className="w-28 px-2 text-right font-mono">{p.value.toLocaleString()}</div>
          <div className="w-24 px-2">
            <Badge variant="secondary" className={cn('text-[10px]', p.status === 'Delivered' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', p.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{p.status}</Badge>
          </div>
          <div className="w-16 px-2 text-center">
            {p.grn ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
          </div>
        </div>
      ))}
    </PaneBody>
  )
}

function GrnCenterView() {
  return (
    <PaneBody className="p-4">
      <div className="rounded-lg border border-[var(--pane-divider)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--pane-divider)] bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          3-Way Match · PO vs GRN vs Invoice
        </div>
        <table className="w-full text-xs">
          <thead className="bg-secondary/20">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left p-2">PO #</th>
              <th className="text-right p-2">PO Qty</th>
              <th className="text-right p-2">GRN Qty</th>
              <th className="text-right p-2">Invoice Qty</th>
              <th className="text-center p-2">Match</th>
              <th className="text-right p-2">Pay Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { po: 'PO-018', poq: 1200, grnq: 1200, invq: 1200, match: true, pay: 'Cleared' },
              { po: 'PO-014', poq: 45, grnq: 38, invq: 38, match: false, pay: 'Partial Hold' },
              { po: 'PO-022', poq: 96, grnq: 0, invq: 0, match: false, pay: 'Awaiting GRN' },
              { po: 'PO-016', poq: 60, grnq: 60, invq: 58, match: false, pay: 'Variance Hold' },
            ].map((r, i) => (
              <tr key={i} className="border-t border-[var(--pane-divider)] row-hover">
                <td className="p-2 font-mono">{r.po}</td>
                <td className="p-2 text-right font-mono">{r.poq}</td>
                <td className="p-2 text-right font-mono">{r.grnq}</td>
                <td className="p-2 text-right font-mono">{r.invq}</td>
                <td className="p-2 text-center">
                  {r.match
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                </td>
                <td className={cn('p-2 text-right text-[11px]', r.pay === 'Cleared' ? 'text-emerald-600' : 'text-amber-600')}>{r.pay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs">
        <div className="font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />Payment gate active</div>
        <div className="text-muted-foreground mt-0.5">2 invoices on hold pending 3-way match reconciliation. NPR 285,600 locked.</div>
      </div>
    </PaneBody>
  )
}

function StockCenterView() {
  return (
    <>
      <div className="px-4 py-3 border-b border-[var(--pane-divider)] bg-secondary/20 flex items-center gap-3 text-xs">
        <Badge variant="outline"><Boxes className="w-3 h-3 mr-1" />5 SKUs · 3 warehouses</Badge>
        <span className="text-muted-foreground">Total stock value: <span className="font-mono font-semibold text-foreground">NPR 1,924,840</span></span>
      </div>
      <PaneBody className="px-0">
        <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
          <div className="w-32 px-2">Code</div>
          <div className="flex-1 px-2">Material</div>
          <div className="w-20 px-2 text-right">On Hand</div>
          <div className="w-20 px-2 text-right">Reserved</div>
          <div className="w-20 px-2 text-right">Available</div>
          <div className="w-28 px-2 text-right">Avg Cost</div>
          <div className="flex-1 px-2">Warehouse</div>
        </div>
        {STOCK.map(s => {
          const lowStock = s.available < s.onHand * 0.3
          return (
            <div key={s.code} className={cn('flex items-center h-9 border-b border-[var(--pane-divider)] text-xs row-hover', lowStock && 'bg-amber-500/5')}>
              <div className="w-32 px-2 font-mono text-muted-foreground">{s.code}</div>
              <div className="flex-1 px-2 font-medium">{s.name}</div>
              <div className="w-20 px-2 text-right font-mono">{s.onHand.toLocaleString()}</div>
              <div className="w-20 px-2 text-right font-mono text-muted-foreground">{s.reserved.toLocaleString()}</div>
              <div className={cn('w-20 px-2 text-right font-mono font-medium', lowStock && 'text-amber-600')}>{s.available.toLocaleString()}</div>
              <div className="w-28 px-2 text-right font-mono">{s.avgCost.toLocaleString()}</div>
              <div className="flex-1 px-2 text-muted-foreground text-[10px] truncate">{s.warehouse}</div>
            </div>
          )
        })}
      </PaneBody>
    </>
  )
}

function MinCenterView() {
  return (
    <PaneBody className="p-4 space-y-2">
      {[
        { id: 'MIN-0042', date: '30 Jul', task: 'T-203 PCC M15', items: '392 bags cement, 12.8 cum sand', issued: 'Bikash R.', status: 'Issued' },
        { id: 'MIN-0041', date: '29 Jul', task: 'T-301 Base slab', items: '3.2 MT steel, 60 sheets ply', issued: 'Bikash R.', status: 'Issued' },
        { id: 'MIN-0040', date: '29 Jul', task: 'T-201 Excavation', items: '— (no material)', issued: 'Bikash R.', status: 'N/A' },
      ].map(m => (
        <div key={m.id} className="rounded-lg border border-[var(--pane-divider)] p-3 hover:bg-accent/30 cursor-pointer">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
            <span className="text-xs text-muted-foreground">{m.date}</span>
            <Badge variant="secondary" className="text-[9px]">{m.status}</Badge>
            <span className="ml-auto text-xs">{m.task}</span>
          </div>
          <div className="text-xs text-muted-foreground">{m.items}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Issued by: {m.issued}</div>
        </div>
      ))}
      <div className="text-[11px] text-muted-foreground p-3 border-t border-[var(--pane-divider)]">
        MIN links material issue to specific DSR task. Stock deducted in real-time. Variance vs theoretical tracked in DSR Inspector.
      </div>
    </PaneBody>
  )
}

function ProcurementInspector({ tab, selectedId }: { tab: Tab; selectedId: string }) {
  const req = REQS.find(r => r.id === selectedId) ?? REQS[0]
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
