'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Search, Plus, Trophy, AlertTriangle, CheckCircle2, Package, FileText,
  Truck, Boxes, ArrowRight, Layers, MapPin, TrendingUp, X, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Tab = 'req' | 'po' | 'grn' | 'stock' | 'min'

interface Vendor { name: string; rate: number; selected?: boolean }
interface ReqItem {
  id: string; item: string; uom: string; qty: number;
  vendors: Vendor[];
  status: 'Draft' | 'Approved' | 'Partially PO\'d' | 'Fully PO\'d';
  source: 'Sched' | 'Manual'
  overrideReason?: string
}

const INITIAL_REQS: ReqItem[] = [
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

interface Po { id: string; vendor: string; date: string; value: number; status: 'Delivered' | 'Partial' | 'Pending'; items: number; grn: boolean }

const INITIAL_POS: Po[] = [
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
  const [reqs, setReqs] = useState<ReqItem[]>(() => JSON.parse(JSON.stringify(INITIAL_REQS)))
  const [pos, setPos] = useState<Po[]>(() => JSON.parse(JSON.stringify(INITIAL_POS)))
  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{ reqId: string; vendorName: string; vendorRate: number; lowestRate: number } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  // Generate POs from approved requisitions — auto-group by vendor, merge duplicates
  const generatePos = () => {
    const approvedReqs = reqs.filter(r => r.status === 'Approved' || r.status === 'Partially PO\'d')
    if (approvedReqs.length === 0) {
      toast.error('No approved requisitions', { description: 'Approve requisitions first before generating POs.' })
      return
    }

    // Group by selected vendor
    const vendorGroups = new Map<string, { reqs: ReqItem[]; totalValue: number; itemCount: number }>()
    for (const r of approvedReqs) {
      const selectedVendor = r.vendors.find(v => v.selected)
      if (!selectedVendor) continue
      const existing = vendorGroups.get(selectedVendor.name) || { reqs: [], totalValue: 0, itemCount: 0 }
      existing.reqs.push(r)
      existing.totalValue += r.qty * selectedVendor.rate
      existing.itemCount += 1
      vendorGroups.set(selectedVendor.name, existing)
    }

    // Create one PO per vendor
    const newPOs: Po[] = []
    let poNum = 19 // starting after existing PO-018
    for (const [vendor, group] of vendorGroups) {
      const po: Po = {
        id: `PO-2410-${String(poNum).padStart(3, '0')}`,
        vendor,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        value: group.totalValue,
        status: 'Pending',
        items: group.itemCount,
        grn: false,
      }
      newPOs.push(po)
      poNum++
    }

    setPos(prev => [...newPOs, ...prev])

    // Mark requisitions as Fully PO'd
    setReqs(prev => prev.map(r => {
      if (approvedReqs.find(ar => ar.id === r.id)) {
        return { ...r, status: 'Fully PO\'d' as const }
      }
      return r
    }))

    toast.success(`${newPOs.length} PO${newPOs.length > 1 ? 's' : ''} generated`, {
      description: newPOs.map(p => `${p.id} → ${p.vendor} · NPR ${p.value.toLocaleString()}`).join('\n'),
    })

    // Switch to PO tab to show the new POs
    setTab('po')
  }

  // Select a vendor. If the vendor is NOT the lowest bidder, open the override modal.
  const selectVendor = (reqId: string, vendorName: string) => {
    const req = reqs.find(r => r.id === reqId)
    if (!req) return
    const vendor = req.vendors.find(v => v.name === vendorName)
    if (!vendor) return
    const lowest = Math.min(...req.vendors.map(v => v.rate))
    if (vendor.rate > lowest && !vendor.selected) {
      // Open override modal — don't select yet
      setOverrideModal({ reqId, vendorName, vendorRate: vendor.rate, lowestRate: lowest })
      setOverrideReason('')
    } else {
      // Select directly (lowest bidder or re-selecting already-selected)
      applyVendorSelection(reqId, vendorName)
      toast.success(`${vendorName} selected`, {
        description: vendor.rate === lowest ? 'Lowest bidder auto-confirmed' : 'Vendor selected',
      })
    }
  }

  const applyVendorSelection = (reqId: string, vendorName: string) => {
    setReqs(prev => prev.map(r => r.id === reqId ? {
      ...r,
      vendors: r.vendors.map(v => ({ ...v, selected: v.name === vendorName })),
    } : r))
  }

  const confirmOverride = () => {
    if (!overrideModal) return
    if (!overrideReason.trim()) {
      toast.error('Justification required', { description: 'Please provide a reason for overriding the lowest bidder.' })
      return
    }
    applyVendorSelection(overrideModal.reqId, overrideModal.vendorName)
    // Save the reason on the req
    setReqs(prev => prev.map(r => r.id === overrideModal.reqId ? { ...r, overrideReason: overrideReason.trim() } : r))
    toast.success('Override approved', {
      description: `${overrideModal.vendorName} selected with justification. Audit logged.`,
    })
    setOverrideModal(null)
    setOverrideReason('')
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <Workspace3Pane
        leftPane={
          <>
            <PaneHeader title="Procurement">
              <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
            </PaneHeader>
            <div className="py-2">
              {([
                { id: 'req', name: 'Requisitions', count: reqs.length, icon: FileText },
                { id: 'po', name: 'Purchase Orders', count: pos.length, icon: Package },
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
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => tab === 'grn' ? toast.info('GRN Receiving Form', { description: 'Select a PO, enter received qty, attach delivery note. System verifies against PO qty.' }) : undefined}><Plus className="w-3.5 h-3.5" />New {tab === 'req' ? 'Requisition' : tab === 'po' ? 'Consolidated PO' : tab === 'grn' ? 'GRN' : tab === 'stock' ? 'Material' : 'MIN'}</Button>
            </PaneHeader>

            {tab === 'req' && (
              <ReqCenterView reqs={reqs} selectedId={selectedId} onSelect={setSelectedId} onVendorSelect={selectVendor} onGeneratePos={generatePos} />
            )}
            {tab === 'po' && <PoCenterView pos={pos} />}
            {tab === 'grn' && <GrnCenterView />}
            {tab === 'stock' && <StockCenterView />}
            {tab === 'min' && <MinCenterView />}
          </>
        }
        rightPane={<ProcurementInspector tab={tab} selectedId={selectedId} reqs={reqs} />}
        leftPaneWidth="260px"
        rightPaneWidth="380px"
      />

      {/* Override Justification Modal */}
      {overrideModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOverrideModal(null)}
        >
          <div
            className="w-full max-w-md pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-amber-500/10">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">Override Justification Required</span>
              </div>
              <button onClick={() => setOverrideModal(null)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                You are selecting a vendor that is <span className="font-semibold text-amber-600">NPR {(overrideModal.vendorRate - overrideModal.lowestRate).toLocaleString()}</span> above the lowest bidder. FIDIC Clause 4.1 requires documented justification for non-lowest bids.
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Lowest Bidder</div>
                  <div className="font-mono font-bold text-emerald-600 mt-0.5">NPR {overrideModal.lowestRate.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Selected Vendor</div>
                  <div className="font-mono font-bold text-amber-600 mt-0.5">NPR {overrideModal.vendorRate.toLocaleString()}</div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Justification <span className="text-red-500">*</span></label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Better delivery lead-time (3 days vs 7 days), proven quality track record, existing framework agreement..."
                  className="mt-1 text-xs min-h-[80px]"
                  autoFocus
                />
                <div className="text-[10px] text-muted-foreground mt-1">This will be permanently logged in the audit trail.</div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOverrideModal(null)}>Cancel</Button>
                <Button size="sm" onClick={confirmOverride} className="gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Override
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ReqCenterView({ reqs, selectedId, onSelect, onVendorSelect, onGeneratePos }: {
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

function PoCenterView({ pos }: { pos: Po[] }) {
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
      {pos.map(p => (
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
  const [rows, setRows] = useState([
    { po: 'PO-018', vendor: 'Udaipur Cement', poq: 1200, grnq: 1200, invq: 1200, pay: 'Cleared' as 'Cleared' | 'Hold' | 'Partial Hold' | 'Awaiting GRN' },
    { po: 'PO-014', vendor: 'Trishuli Sand', poq: 45, grnq: 38, invq: 38, pay: 'Partial Hold' as const },
    { po: 'PO-022', vendor: 'Hetauda Aggregates', poq: 96, grnq: 0, invq: 0, pay: 'Awaiting GRN' as const },
    { po: 'PO-016', vendor: 'Ghorahi Ply', poq: 60, grnq: 60, invq: 58, pay: 'Hold' as const },
  ])

  // 3-way match check: PO qty === GRN qty === Invoice qty
  const isMatched = (r: typeof rows[0]) => r.poq === r.grnq && r.grnq === r.invq
  const lockedAmount = rows.filter(r => !isMatched(r) && r.grnq > 0).reduce((sum, r) => sum + r.invq * 920, 0) // simplified rate

  // Toggle payment approval — only allowed if 3-way match passes
  const toggleApproval = (po: string) => {
    setRows(prev => prev.map(r => {
      if (r.po !== po) return r
      if (!isMatched(r)) {
        toast.error('Payment locked', { description: `${po} fails 3-way match. PO ${r.poq} ≠ GRN ${r.grnq} ≠ Inv ${r.invq}. Cannot approve.` })
        return r
      }
      const newPay = r.pay === 'Cleared' ? 'Hold' : 'Cleared'
      toast.success(newPay === 'Cleared' ? 'Payment cleared' : 'Payment held', { description: `${po} — 3-way match verified` })
      return { ...r, pay: newPay }
    }))
  }

  return (
    <PaneBody className="p-4">
      <div className="rounded-lg border border-[var(--pane-divider)] overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--pane-divider)] bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>3-Way Match · PO vs GRN vs Invoice</span>
          <span className="text-[10px] normal-case font-normal">Click ✓ to approve — locked if mismatch</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-secondary/20">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left p-2">PO #</th>
              <th className="text-left p-2">Vendor</th>
              <th className="text-right p-2">PO Qty</th>
              <th className="text-right p-2">GRN Qty</th>
              <th className="text-right p-2">Invoice Qty</th>
              <th className="text-center p-2">Match</th>
              <th className="text-right p-2">Pay Status</th>
              <th className="text-center p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const matched = isMatched(r)
              return (
                <tr key={i} className="border-t border-[var(--pane-divider)] row-hover">
                  <td className="p-2 font-mono">{r.po}</td>
                  <td className="p-2 truncate">{r.vendor}</td>
                  <td className="p-2 text-right font-mono">{r.poq}</td>
                  <td className="p-2 text-right font-mono">{r.grnq}</td>
                  <td className="p-2 text-right font-mono">{r.invq}</td>
                  <td className="p-2 text-center">
                    {matched
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                  </td>
                  <td className={cn('p-2 text-right text-[11px] font-medium',
                    r.pay === 'Cleared' ? 'text-emerald-600' : 'text-amber-600')}>
                    {r.pay}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => toggleApproval(r.po)}
                      disabled={!matched}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        matched
                          ? r.pay === 'Cleared'
                            ? 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
                            : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25'
                          : 'bg-secondary text-muted-foreground/40 cursor-not-allowed'
                      )}
                      title={matched ? 'Toggle payment approval' : 'Locked — 3-way match fails'}
                    >
                      {matched ? (r.pay === 'Cleared' ? 'Hold' : 'Approve') : '🔒 Locked'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={cn('mt-3 p-3 rounded-md text-xs', lockedAmount > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30')}>
        <div className={cn('font-medium flex items-center gap-1.5', lockedAmount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
          {lockedAmount > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {lockedAmount > 0 ? 'Payment gate active' : 'All payments cleared'}
        </div>
        <div className="text-muted-foreground mt-0.5">
          {lockedAmount > 0
            ? `${rows.filter(r => !isMatched(r) && r.grnq > 0).length} invoices on hold pending 3-way match reconciliation. NPR ${lockedAmount.toLocaleString()} locked.`
            : 'All 3-way matches verified. All payments approved.'}
        </div>
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

function ProcurementInspector({ tab, selectedId, reqs }: { tab: Tab; selectedId: string; reqs: ReqItem[] }) {
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
