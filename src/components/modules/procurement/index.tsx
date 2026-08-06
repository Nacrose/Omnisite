'use client'

import { useState, useRef } from 'react'
import { Workspace2Pane, PaneHeader } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  FileText,
  Package,
  CheckCircle2,
  Boxes,
  ArrowRight,
  X,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Po,
  ReqItem,
  Grn,
  StockItem,
  MinNote,
  Tab,
  STOCK,
  INITIAL_MINS,
  Vendor as BidVendor,
} from './types'
import { INITIAL_POS, INITIAL_REQS, INITIAL_GRNS, INITIAL_STOCK } from './types'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { ReqCenterView } from './req-view'
import { PoCenterView, GrnCenterView, StockCenterView, MinCenterView } from './po-grn-views'
import { ProcurementInspector } from './inspector'
import { performThreeWayMatch } from '@/lib/three-way-match'

export function ProcurementModule() {
  const [tab, setTab] = useState<Tab>('req')
  const [selectedId, setSelectedId] = useState('REQ-0142')
  const [reqs, setReqs, reqsLoading] = useSyncedState<ReqItem[]>(
    'omnisite-procurement-reqs',
    'requisitions',
    () => structuredClone(INITIAL_REQS) as typeof INITIAL_REQS,
    { fieldMap: { overrideReason: 'override_reason' }, primaryKey: 'id' }
  )
  const [pos, setPos, posLoading] = useSyncedState<Po[]>(
    'omnisite-procurement-pos',
    'purchase_orders',
    () => structuredClone(INITIAL_POS) as typeof INITIAL_POS,
    {
      fieldMap: {
        // The app type (Po in procurement/types.ts) uses `grn: boolean` while
        // the DB column is `has_grn`. The previous `hasGrn: 'has_grn'` entry
        // was dead — there is no `hasGrn` field on the Po type — so the
        // camelToSnake auto-convert kicked in and produced `grn: 'grn'`,
        // which the DB rejected (no such column). The boolean GRN flag was
        // therefore silently dropped on every POST.
        grn: 'has_grn',
        reqId: 'req_id',
        materialCode: 'material_code',
        poQty: 'po_qty',
      },
      primaryKey: 'id',
    }
  )
  const [grns, setGrns, grnsLoading] = useSyncedState<Grn[]>(
    'omnisite-procurement-grns',
    'grns',
    () => structuredClone(INITIAL_GRNS) as typeof INITIAL_GRNS,
    {
      fieldMap: {
        poId: 'po_id',
        poQty: 'po_qty',
        grnQty: 'grn_qty',
        invoiceQty: 'invoice_qty',
        payStatus: 'pay_status',
        materialCode: 'material_code',
      },
      primaryKey: 'id',
    }
  )
  const [stock, setStock, stockLoading] = useSyncedState<StockItem[]>(
    'omnisite-procurement-stock',
    'stock_items',
    () => structuredClone(INITIAL_STOCK) as typeof INITIAL_STOCK,
    { fieldMap: { onHand: 'on_hand', avgCost: 'avg_cost' }, primaryKey: 'code' }
  )
  // MINs (Material Issue Notes) — now backed by the `material_issue_notes`
  // DB table + /api/material-issue-notes route (migration 29). Previously
  // this was a localStorage-only stopgap (usePersistentState) because the
  // table didn't exist — switching to useSyncedState would have hit a 404
  // and polluted the console with upsert errors. Now that the table + route
  // are live, useSyncedState gives us cross-device sync + realtime updates.
  // Falls back to localStorage in demo mode (no Supabase configured).
  const [mins, _setMins, minsLoading] = useSyncedState<MinNote[]>(
    'omnisite-procurement-mins',
    'material_issue_notes',
    () => structuredClone(INITIAL_MINS) as typeof INITIAL_MINS,
    { primaryKey: 'id' }
  )
  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{
    reqId: string
    vendorName: string
    vendorRate: number
    lowestRate: number
  } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const overrideModalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(overrideModalRef, overrideModal !== null)

  // Generate POs from approved requisitions — auto-group by vendor, merge duplicates
  const generatePos = () => {
    const approvedReqs = reqs.filter(
      (r) => r.status === 'Approved' || r.status === "Partially PO'd"
    )
    if (approvedReqs.length === 0) {
      toast.error('No approved requisitions', {
        description: 'Approve requisitions first before generating POs.',
      })
      return
    }

    // Group by selected vendor
    const vendorGroups = new Map<
      string,
      { reqs: ReqItem[]; totalValue: number; itemCount: number }
    >()
    for (const r of approvedReqs) {
      const selectedVendor = r.vendors.find((v) => v.selected)
      if (!selectedVendor) continue
      const existing = vendorGroups.get(selectedVendor.name) || {
        reqs: [],
        totalValue: 0,
        itemCount: 0,
      }
      existing.reqs.push(r)
      existing.totalValue += r.qty * selectedVendor.rate
      existing.itemCount += 1
      vendorGroups.set(selectedVendor.name, existing)
    }

    // Create one PO per vendor.
    // Derive the next PO number from the EXISTING POs so repeated clicks
    // don't generate duplicate IDs (the original implementation always
    // started at PO-2410-019, so the second click would collide).
    const newPOs: Po[] = []
    const maxNum = pos.reduce((max, p) => {
      const m = p.id.match(/PO-\d+-(\d+)/)
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 18)
    let poNum = maxNum + 1
    // Track which reqs actually got a PO generated (audit P6-2 — previously
    // ALL approved/partially-PO'd reqs were marked "Fully PO'd" even if they
    // had no selected vendor and were skipped).
    const reqsWithPO = new Set<string>()
    for (const [vendor, group] of vendorGroups) {
      // Use the first req's material code and the selected vendor's rate
      // to populate the PO's traceability fields (audit P3-5, P4-1, P4-2).
      const firstReq = group.reqs[0]
      const selectedVendor = firstReq.vendors.find((v) => v.name === vendor)
      const po: Po = {
        id: `PO-2410-${String(poNum).padStart(3, '0')}`,
        vendor,
        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        value: group.totalValue,
        status: 'Pending',
        items: group.itemCount,
        grn: false,
        // Traceability fields (audit P3-5, P4-1, P4-2):
        reqId: firstReq.id,
        rate: selectedVendor?.rate,
        poQty: group.reqs.reduce((sum, r) => sum + r.qty, 0),
      }
      newPOs.push(po)
      poNum++
      group.reqs.forEach((r) => reqsWithPO.add(r.id))
    }

    setPos((prev) => [...newPOs, ...prev])

    // Mark requisitions that actually got a PO as Fully PO'd.
    // Only reqs with a selected vendor get a PO — reqs without a vendor
    // are left unchanged (audit P6-2).
    setReqs((prev) =>
      prev.map((r) => {
        if (reqsWithPO.has(r.id)) {
          return { ...r, status: "Fully PO'd" as const }
        }
        return r
      })
    )

    toast.success(`${newPOs.length} PO${newPOs.length > 1 ? 's' : ''} generated`, {
      description: newPOs
        .map((p) => `${p.id} → ${p.vendor} · NPR ${p.value.toLocaleString()}`)
        .join('\n'),
    })

    // Switch to PO tab to show the new POs
    setTab('po')
  }

  // Select a vendor. If the vendor is NOT the lowest bidder, open the override modal.
  const selectVendor = (reqId: string, vendorName: string) => {
    const req = reqs.find((r) => r.id === reqId)
    if (!req) return
    const vendor = req.vendors.find((v) => v.name === vendorName)
    if (!vendor) return
    const lowest = Math.min(...req.vendors.map((v) => v.rate))
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
    setReqs((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              vendors: r.vendors.map((v) => ({ ...v, selected: v.name === vendorName })),
            }
          : r
      )
    )
  }

  // Push a new vendor bid (from the vendor picker) onto a requisition. The
  // new bid starts unselected — the user still has to click it in the
  // comparative statement to select it (and trigger the override flow if
  // it's not the lowest). Duplicates are blocked upstream in the picker.
  const addVendorBid = (reqId: string, vendor: BidVendor) => {
    setReqs((prev) =>
      prev.map((r) =>
        r.id === reqId ? { ...r, vendors: [...r.vendors, { ...vendor, selected: false }] } : r
      )
    )
  }

  const confirmOverride = () => {
    if (!overrideModal) return
    if (!overrideReason.trim()) {
      toast.error('Justification required', {
        description: 'Please provide a reason for overriding the lowest bidder.',
      })
      return
    }
    applyVendorSelection(overrideModal.reqId, overrideModal.vendorName)
    // Save the reason on the req
    setReqs((prev) =>
      prev.map((r) =>
        r.id === overrideModal.reqId ? { ...r, overrideReason: overrideReason.trim() } : r
      )
    )
    toast.success('Override approved', {
      description: `${overrideModal.vendorName} selected with justification. Audit logged.`,
    })
    setOverrideModal(null)
    setOverrideReason('')
  }

  if (reqsLoading || posLoading || grnsLoading || stockLoading || minsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading procurement data…" />
      </div>
    )
  }

  return (
    <>
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Procurement">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  // Add a new blank requisition and switch to the req tab
                  // (audit P1-2 — previously showed a "coming soon" toast).
                  const newId = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
                  setReqs((prev) => [
                    {
                      id: newId,
                      item: 'New requisition',
                      uom: 'cum',
                      qty: 0,
                      status: 'Draft',
                      source: 'Manual',
                      vendors: [],
                    },
                    ...prev,
                  ])
                  setSelectedId(newId)
                  setTab('req')
                  toast.success('Requisition created', {
                    description: `${newId} — fill in the details and add vendor bids.`,
                  })
                }}
                title="New requisition"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <div className="py-2">
              {/* Compute counts from real arrays so badges never lie. */}
              {(() => {
                const stockValue = stock.reduce((s, x) => s + x.onHand * x.avgCost, 0)
                const committed = pos.reduce((s, p) => s + p.value, 0)
                const openPos = pos.filter((p) => p.status !== 'Delivered').length
                const tabs = [
                  { id: 'req' as Tab, name: 'Requisitions', count: reqs.length, icon: FileText },
                  { id: 'po' as Tab, name: 'Purchase Orders', count: pos.length, icon: Package },
                  {
                    id: 'grn' as Tab,
                    name: 'GRN / 3-Way Match',
                    count: grns.length,
                    icon: CheckCircle2,
                  },
                  { id: 'stock' as Tab, name: 'Live Stock', count: stock.length, icon: Boxes },
                  {
                    id: 'min' as Tab,
                    name: 'Material Issues (MIN)',
                    count: mins.length,
                    icon: ArrowRight,
                  },
                ]
                return (
                  <>
                    {tabs.map((t) => {
                      const Icon = t.icon
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className={cn(
                            'flex h-9 w-full items-center gap-2.5 px-4 text-xs transition-colors',
                            tab === t.id
                              ? 'bg-accent border-primary border-l-2'
                              : 'hover:bg-accent/50 border-l-2 border-transparent'
                          )}
                        >
                          <Icon className="text-muted-foreground h-3.5 w-3.5" />
                          <span className="flex-1 text-left">{t.name}</span>
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            {t.count}
                          </Badge>
                        </button>
                      )
                    })}
                    <div className="mt-auto space-y-1 border-t border-[var(--pane-divider)] p-3 text-xs">
                      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Procurement Snapshot
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Open POs</span>
                        <span className="font-mono">{openPos}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Committed cost</span>
                        <span className="font-mono">NPR {(committed / 1_000_000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock value</span>
                        <span className="font-mono">
                          NPR {(stockValue / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </>
        }
        centerPane={
          <>
            <PaneHeader
              title={
                tab === 'req'
                  ? 'Requisitions & Comparative Statement'
                  : tab === 'po'
                    ? 'Purchase Orders'
                    : tab === 'grn'
                      ? 'GRN & 3-Way Match'
                      : tab === 'stock'
                        ? 'Live Stock Dashboard'
                        : 'Material Issue Notes'
              }
            >
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  // Create a new entry for the active tab (audit P1-4 —
                  // previously showed a "coming soon" toast for all tabs).
                  if (tab === 'req') {
                    const newId = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
                    setReqs((prev) => [
                      {
                        id: newId,
                        item: 'New requisition',
                        uom: 'cum',
                        qty: 0,
                        status: 'Draft',
                        source: 'Manual',
                        vendors: [],
                      },
                      ...prev,
                    ])
                    setSelectedId(newId)
                    toast.success('Requisition created', { description: newId })
                  } else if (tab === 'po') {
                    // POs are generated from approved requisitions, not
                    // created manually — point the user to the req tab.
                    toast.info('POs are generated from requisitions', {
                      description:
                        'Switch to the Requisitions tab, select vendors, and click "Generate POs".',
                    })
                  } else if (tab === 'grn') {
                    toast.info('GRNs are created from delivered POs', {
                      description:
                        'Switch to the Purchase Orders tab and mark a PO as Delivered to auto-generate a GRN.',
                    })
                  } else if (tab === 'stock') {
                    const newCode = `MAT-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
                    setStock((prev) => [
                      {
                        code: newCode,
                        name: 'New material',
                        onHand: 0,
                        reserved: 0,
                        avgCost: 0,
                        warehouse: 'Main',
                      },
                      ...prev,
                    ])
                    toast.success('Stock item created', { description: newCode })
                  } else if (tab === 'min') {
                    toast.info('MIN creation requires a linked DSR entry', {
                      description:
                        'Create a MIN from the Daily Ops → DSR Inspector → Material Reconciliation tab.',
                    })
                  }
                }}
                title="New entry"
              >
                <Plus className="h-3.5 w-3.5" />
                New{' '}
                {tab === 'req'
                  ? 'Requisition'
                  : tab === 'po'
                    ? 'Consolidated PO'
                    : tab === 'grn'
                      ? 'GRN'
                      : tab === 'stock'
                        ? 'Material'
                        : 'MIN'}
              </Button>
            </PaneHeader>

            {tab === 'req' && (
              <ReqCenterView
                reqs={reqs}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onVendorSelect={selectVendor}
                onGeneratePos={generatePos}
                onAddVendorBid={addVendorBid}
              />
            )}
            {tab === 'po' && <PoCenterView pos={pos} />}
            {tab === 'grn' && (
              <GrnCenterView
                grns={grns}
                onToggleApproval={(grnId) => {
                  setGrns((prev) =>
                    prev.map((g) => {
                      if (g.id !== grnId) return g
                      // 3-way match using the same tolerance-based service
                      // that gates the Approve button in po-grn-views.tsx
                      // (default: 5% qty, 2% rate, 3% amount). The previous
                      // exact-equality check (poQty === grnQty === invoiceQty
                      // && poRate === rate) blocked within-tolerance GRNs
                      // with "Payment locked" — directly contradicting the
                      // tolerance check that enabled the button.
                      const match = performThreeWayMatch({
                        poQty: g.poQty,
                        poRate: g.poRate ?? g.rate,
                        grnQty: g.grnQty,
                        grnRate: g.rate,
                        invoiceQty: g.invoiceQty,
                        invoiceRate: g.rate,
                      })
                      if (match.status !== 'MATCHED') {
                        toast.error('Payment locked', {
                          description: `${g.poId} fails 3-way match — ${match.details.join(' · ')}`,
                        })
                        return g
                      }
                      const newPay: Grn['payStatus'] =
                        g.payStatus === 'Cleared'
                          ? 'Hold'
                          : g.payStatus === 'Hold'
                            ? 'Cleared'
                            : g.payStatus
                      toast.success(newPay === 'Cleared' ? 'Payment cleared' : 'Payment held', {
                        description: `${g.poId} — 3-way match verified`,
                      })
                      return { ...g, payStatus: newPay }
                    })
                  )
                }}
              />
            )}
            {tab === 'stock' && <StockCenterView stock={stock} />}
            {tab === 'min' && <MinCenterView mins={mins} />}
          </>
        }
        rightPane={
          <ProcurementInspector
            tab={tab}
            selectedId={selectedId}
            reqs={reqs}
            onGeneratePos={generatePos}
            onApprove={(reqId) => {
              setReqs((prev) =>
                prev.map((r) => (r.id === reqId ? { ...r, status: 'Approved' as const } : r))
              )
              toast.success('Requisition approved', {
                description: `${reqId} is ready for PO generation.`,
              })
            }}
            onMarkFullyPod={(reqId) => {
              setReqs((prev) =>
                prev.map((r) => (r.id === reqId ? { ...r, status: "Fully PO'd" as const } : r))
              )
              toast.success('Requisition marked Fully PO\u2019d', { description: reqId })
            }}
            onCancelReq={(reqId) => {
              setReqs((prev) => prev.filter((r) => r.id !== reqId))
              toast.success('Requisition cancelled', { description: `${reqId} removed.` })
            }}
          />
        }
        leftPaneWidth="260px"
        rightPaneWidth="380px"
      />

      {/* Override Justification Modal */}
      {overrideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setOverrideModal(null)}
        >
          <div
            ref={overrideModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="override-modal-title"
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-amber-500/10 px-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span id="override-modal-title" className="text-sm font-semibold">
                  Override Justification Required
                </span>
              </div>
              <button
                onClick={() => setOverrideModal(null)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
                aria-label="Close override dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="text-muted-foreground text-xs">
                You are selecting a vendor that is{' '}
                <span className="font-semibold text-amber-600">
                  NPR {(overrideModal.vendorRate - overrideModal.lowestRate).toLocaleString()}
                </span>{' '}
                above the lowest bidder. FIDIC Clause 4.1 requires documented justification for
                non-lowest bids.
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Lowest Bidder
                  </div>
                  <div className="mt-0.5 font-mono font-bold text-emerald-600">
                    NPR {overrideModal.lowestRate.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Selected Vendor
                  </div>
                  <div className="mt-0.5 font-mono font-bold text-amber-600">
                    NPR {overrideModal.vendorRate.toLocaleString()}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">
                  Justification <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Better delivery lead-time (3 days vs 7 days), proven quality track record, existing framework agreement..."
                  className="mt-1 min-h-[80px] text-xs"
                  autoFocus
                />
                <div className="text-muted-foreground mt-1 text-[10px]">
                  This will be permanently logged in the audit trail.
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOverrideModal(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={confirmOverride} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
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
