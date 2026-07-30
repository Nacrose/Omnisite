'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Search, Plus, FileText, Package, CheckCircle2, Boxes, ArrowRight,
  X, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Po, ReqItem, Tab } from './types'
import { INITIAL_POS, INITIAL_REQS } from './types'
import { ReqCenterView } from './req-view'
import { PoCenterView, GrnCenterView, StockCenterView, MinCenterView } from './po-grn-views'
import { ProcurementInspector } from './inspector'

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
      <Workspace2Pane
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

export default ProcurementModule
