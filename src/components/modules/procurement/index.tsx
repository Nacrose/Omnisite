'use client'

import { useState, useRef } from 'react'
import { Workspace2Pane, PaneHeader } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Search,
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
import { usePersistentState } from '@/lib/use-persistent-state'
import { LoadingState } from '@/components/ui/loading-state'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { ReqCenterView } from './req-view'
import { PoCenterView, GrnCenterView, StockCenterView, MinCenterView } from './po-grn-views'
import { ProcurementInspector } from './inspector'

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
  // MINs (Material Issue Notes) are localStorage-only — there is currently
  // no `material_issue_notes` API route or DB table. useSyncedState would
  // try to POST to `/api/material_issue_notes` and fail in Supabase mode,
  // polluting the console with upsert errors. Fall back to
  // usePersistentState so MINs persist across refreshes without hitting
  // the network. When a `material_issue_notes` table + route land,
  // swap this back to useSyncedState('omnisite-procurement-mins',
  // 'material_issue_notes', ...).
  const [mins] = usePersistentState<MinNote[]>(
    'omnisite-procurement-mins',
    () => structuredClone(INITIAL_MINS) as typeof INITIAL_MINS
  )
  // usePersistentState is synchronous, so MINs are never in a loading state.
  const minsLoading = false
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
    for (const [vendor, group] of vendorGroups) {
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
      }
      newPOs.push(po)
      poNum++
    }

    setPos((prev) => [...newPOs, ...prev])

    // Mark requisitions as Fully PO'd.
    // Recompute the predicate INSIDE the updater so we use the latest
    // `prev` state instead of the render-time `approvedReqs` closure.
    setReqs((prev) =>
      prev.map((r) => {
        if (r.status === 'Approved' || r.status === "Partially PO'd") {
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

  if (reqsLoading || posLoading || minsLoading) {
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
                onClick={() =>
                  toast.info('New requisition creation coming soon — use the API or contact admin.')
                }
                title="New requisition (coming soon)"
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
                          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
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
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => toast.info('Use the search box in the center pane.')}
                title="Search (use center pane)"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  const tabName =
                    tab === 'req'
                      ? 'requisition'
                      : tab === 'po'
                        ? 'consolidated PO'
                        : tab === 'grn'
                          ? 'GRN'
                          : tab === 'stock'
                            ? 'material'
                            : 'MIN'
                  toast.info(`New ${tabName} creation coming soon.`)
                }}
                title="New entry (coming soon)"
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
                onToggleApproval={(poId) => {
                  setGrns((prev) =>
                    prev.map((g) => {
                      if (g.poId !== poId) return g
                      // 3-way match: PO qty vs GRN qty vs Invoice qty, AND
                      // PO rate vs Invoice rate. A qty match with a rate
                      // mismatch would still over/under-pay the vendor —
                      // locking payment in that case prevents silent
                      // commercial leakage.
                      const matched =
                        g.poQty === g.grnQty && g.grnQty === g.invoiceQty && g.poRate === g.rate
                      if (!matched) {
                        toast.error('Payment locked', {
                          description: `${poId} fails 3-way match. PO ${g.poQty} ≠ GRN ${g.grnQty} ≠ Inv ${g.invoiceQty} (qty), or PO rate ${g.poRate} ≠ Inv rate ${g.rate}. Cannot approve.`,
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
                        description: `${poId} — 3-way match verified`,
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
        rightPane={<ProcurementInspector tab={tab} selectedId={selectedId} reqs={reqs} />}
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
