'use client'

import { useState, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Trophy, AlertTriangle, Package, Plus, X, Search, ShoppingCart, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { useSyncedState } from '@/lib/use-synced-state'
import { INITIAL_VENDORS } from '@/data/seed/vendors'
import type { Vendor as UnifiedVendor } from '@/lib/types/vendor'
import { ReqItem, Vendor as BidVendor } from './types'

// ─── Requisition Center View ─────────────────────────────────────────────────
//
// Renders the comparative statement: one card per requisition with an
// interactive vendor-bid matrix and an "Add Vendor Bid" button that pops a
// picker sourced from the unified vendors table (suppliers only).
//
// Vendor picker
// -------------
// Clicking "Add Vendor Bid" opens a modal that lists all `category ===
// 'supplier'` vendors from the Supabase `vendors` table (via
// `useSyncedState('omnisite-vendors', 'vendors', …)` — same hook + fieldMap
// the Vendors module uses, so procurement always sees the freshest list,
// including edits from other tabs / users in realtime). For each supplier,
// the picker:
//   1. Looks at their `materialsSupplied` array and tries to match one of
//      those materials to the requisition's `item` text (bidirectional
//      case-insensitive substring match on the material name).
//   2. If a match is found, the catalog rate + uom is shown as a "Catalog
//      rate" hint and prefilled into the rate input.
//   3. The user can override the rate (vendor may quote differently) before
//      clicking "Add Bid" — the manual rate is what gets pushed to the req.
//   4. Suppliers whose name already appears in the req's `vendors` list
//      (substring match — handles "Udaipur Cement" vs "Udaipur Cement Ltd")
//      are marked as "already added" and disabled.

export function ReqCenterView({
  reqs,
  selectedId,
  onSelect,
  onVendorSelect,
  onGeneratePos,
  onAddVendorBid,
}: {
  reqs: ReqItem[]
  selectedId: string
  onSelect: (id: string) => void
  onVendorSelect: (reqId: string, vendorName: string) => void
  onGeneratePos: () => void
  /** Push a new vendor bid onto a requisition. */
  onAddVendorBid: (reqId: string, vendor: BidVendor) => void
}) {
  // The vendor picker is keyed by the req whose "Add Vendor Bid" button was
  // clicked. `null` → picker closed.
  const [pickerReqId, setPickerReqId] = useState<string | null>(null)
  const pickerReq = pickerReqId ? reqs.find((r) => r.id === pickerReqId) : null

  return (
    <>
      <div className="bg-secondary/20 text-muted-foreground border-b border-[var(--pane-divider)] px-4 py-3 text-xs">
        Selecting lowest bidder is automatic (🏆). Choosing a higher bidder requires justification.
        Click a vendor card to select.
      </div>
      <div className="space-y-3 p-3">
        {reqs.map((r) => {
          const lowest = r.vendors.length > 0 ? Math.min(...r.vendors.map((v) => v.rate)) : 0
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
                {r.vendors.map((v) => {
                  const isLowest = r.vendors.length > 0 && v.rate === lowest
                  return (
                    <button
                      key={v.name}
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
              {/* Add-vendor-bid row — opens the supplier picker */}
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 gap-1 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPickerReqId(r.id)
                  }}
                  title="Add a supplier bid from the vendors list"
                >
                  <Plus className="h-3 w-3" />
                  Add Vendor Bid
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-secondary/20 border-t border-[var(--pane-divider)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Consolidated PO Builder</span>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onGeneratePos}
            disabled={
              reqs.filter((r) => r.status === 'Approved' || r.status === "Partially PO'd")
                .length === 0
            }
            title={
              reqs.filter((r) => r.status === 'Approved' || r.status === "Partially PO'd")
                .length === 0
                ? 'No approved requisitions to generate POs from'
                : 'Generate POs from approved requisitions'
            }
          >
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

      {pickerReq && (
        <VendorBidPicker
          req={pickerReq}
          onClose={() => setPickerReqId(null)}
          onAddBid={(vendor) => {
            onAddVendorBid(pickerReq.id, vendor)
            // Keep the picker open so the user can add multiple bids in one
            // session; the just-added supplier will flip to a "✓ Added"
            // disabled state inside the picker so they get visual confirmation.
          }}
        />
      )}
    </>
  )
}

// ─── Vendor Bid Picker modal ─────────────────────────────────────────────────

function VendorBidPicker({
  req,
  onClose,
  onAddBid,
}: {
  req: ReqItem
  onClose: () => void
  onAddBid: (vendor: BidVendor) => void
}) {
  // Read the unified vendors list from the same Supabase `vendors` table
  // (with localStorage fallback) the vendors module writes to. Mirrors the
  // exact fieldMap used by src/components/modules/vendors/index.tsx so the
  // camelCase app fields round-trip to the snake_case DB columns on read.
  // Without this, procurement only saw vendors cached in localStorage and
  // missed any edits made by the Vendors module in another tab (or by
  // another user via Supabase realtime).
  const [vendors] = useSyncedState<UnifiedVendor[]>(
    'omnisite-vendors',
    'vendors',
    () => structuredClone(INITIAL_VENDORS) as UnifiedVendor[],
    {
      fieldMap: {
        tradeName: 'trade_name',
        vatNo: 'vat_no',
        contactPerson: 'contact_person',
        bankAccountName: 'bank_account_name',
        bankAccountNo: 'bank_account_no',
        bankName: 'bank_name',
        bankBranch: 'bank_branch',
        bankIfsc: 'bank_ifsc',
        creditDays: 'credit_days',
        advancePct: 'advance_pct',
        retentionPct: 'retention_pct',
        tdsSection: 'tds_section',
        tdsRate: 'tds_rate',
        materialsSupplied: 'materials_supplied',
        workItems: 'work_items',
        agreementValue: 'agreement_value',
        advancePaid: 'advance_paid',
        reworkCost: 'rework_cost',
        isTunneling: 'is_tunneling',
        materialIssues: 'material_issues',
        materialReturns: 'material_returns',
        customDeductibles: 'custom_deductibles',
        assignedTasks: 'assigned_tasks',
        ncrCount: 'ncr_count',
      },
      primaryKey: 'id',
    }
  )

  const [query, setQuery] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  // Suppliers only (exclude subcontractors, consultants, labour gangs).
  const suppliers = useMemo(
    () => vendors.filter((v) => v.category === 'supplier' && v.status !== 'blacklisted'),
    [vendors]
  )

  // Filter by name search.
  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.tradeName ?? '').toLowerCase().includes(q) ||
        (v.id ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, query])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-bid-picker-title"
        className="pane flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-sky-600" />
            <span id="vendor-bid-picker-title" className="text-sm font-semibold">
              Add Vendor Bid
            </span>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-accent text-muted-foreground rounded p-1"
            aria-label="Close vendor picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Req context strip */}
        <div className="bg-secondary/30 border-b border-[var(--pane-divider)] px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">{req.id}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{req.item}</span>
            <span className="text-muted-foreground ml-auto">
              {req.qty.toLocaleString()} {req.uom}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 text-[10px]">
            Pick a supplier from the vendor list. Catalog rates auto-fill from their supply catalog
            when the material matches — override if their quote differs.
          </div>
        </div>

        {/* Search row */}
        <div className="border-b border-[var(--pane-divider)] px-4 py-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search suppliers…"
              className="h-8 pl-7 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Supplier list */}
        <div className="flex-1 overflow-y-auto">
          {filteredSuppliers.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-xs">
              No suppliers match this search.
            </div>
          ) : (
            filteredSuppliers.map((s) => (
              <SupplierBidRow key={s.id} supplier={s} req={req} onAddBid={onAddBid} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-secondary/20 flex items-center justify-between border-t border-[var(--pane-divider)] px-4 py-2">
          <span className="text-muted-foreground text-[10px]">
            {suppliers.length} suppliers in vendor list · catalog rates pulled from the
            <span className="font-mono"> vendors</span> table
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── One supplier row in the picker ──────────────────────────────────────────

function SupplierBidRow({
  supplier,
  req,
  onAddBid,
}: {
  supplier: UnifiedVendor
  req: ReqItem
  onAddBid: (vendor: BidVendor) => void
}) {
  // ─── Catalog match: find a material in this supplier's catalog whose
  // name matches the req's `item` text. Bidirectional substring match on
  // the material name — handles "Cement OPC 53 Grade" (req.item) vs
  // "Cement OPC 53 Grade (Udaipur)" (catalog name).
  const catalogMatch = useMemo(() => {
    const itemList = (supplier.materialsSupplied ?? []).map((m) => {
      const a = m.name.trim().toLowerCase()
      const b = req.item.trim().toLowerCase()
      const matches = a.includes(b) || b.includes(a)
      return { m, matches }
    })
    return itemList.find((x) => x.matches)?.m ?? null
  }, [supplier, req.item])

  // Rate input — defaults to the catalog rate if a match was found; user
  // can override. Stored as a string for the input value so transient
  // states ("920." or empty) don't get coerced to 0.
  const [rateStr, setRateStr] = useState(catalogMatch ? String(catalogMatch.rate) : '')
  // Re-seed the rate input if the supplier or matched material changes
  // (e.g., user opens the picker again on a different req). The `useEffect`
  // is avoided on purpose — re-mounting the row by keying on `${supplier.id}`
  // would also work, but re-seeding via `useMemo` of the default keeps the
  // row mounted and just resets the draft when the input hasn't been touched
  // yet. Since this row is rendered inside a picker that mounts fresh each
  // open, the initial state above already handles it.
  const rate = Number(rateStr)
  const rateValid = Number.isFinite(rate) && rate > 0

  // Already-added check: is this supplier already in the req's vendor list?
  // Use bidirectional substring match to handle "Udaipur Cement" vs
  // "Udaipur Cement Ltd".
  const alreadyAdded = useMemo(() => {
    const a = supplier.name.trim().toLowerCase()
    return req.vendors.some((v) => {
      const b = v.name.trim().toLowerCase()
      return a.includes(b) || b.includes(a)
    })
  }, [supplier.name, req.vendors])

  const handleAdd = () => {
    if (!rateValid) {
      toast.error('Enter a valid rate', { description: 'Rate must be a positive number.' })
      return
    }
    onAddBid({ name: supplier.name, rate, selected: false })
    toast.success('Bid added', {
      description: `${supplier.name} · NPR ${rate.toLocaleString()} / ${req.uom}`,
    })
  }

  return (
    <div className="hover:bg-accent/30 flex items-center gap-3 border-b border-[var(--pane-divider)] px-4 py-2.5">
      {/* Supplier identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">{supplier.name}</span>
          <Badge variant="outline" className="text-[9px]">
            {supplier.id}
          </Badge>
          {supplier.tradeName && supplier.tradeName !== '—' && (
            <Badge variant="secondary" className="text-[9px]">
              {supplier.tradeName}
            </Badge>
          )}
        </div>
        {/* Catalog hint */}
        <div className="text-muted-foreground mt-0.5 text-[10px]">
          {catalogMatch ? (
            <span className="flex items-center gap-1">
              <Package className="h-2.5 w-2.5" />
              Catalog: <span className="font-mono">{catalogMatch.code}</span>
              <span>·</span>
              <span className="font-mono">NPR {catalogMatch.rate.toLocaleString()}</span>
              <span>/ {catalogMatch.uom}</span>
            </span>
          ) : (
            <span className="text-muted-foreground/60">No catalog match — enter rate manually</span>
          )}
        </div>
      </div>

      {/* Rate input */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-[10px]">NPR</span>
        <Input
          type="number"
          min={0}
          disabled={alreadyAdded}
          className="h-7 w-24 font-mono text-xs"
          value={rateStr}
          onChange={(e) => setRateStr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && rateValid && !alreadyAdded) handleAdd()
          }}
          placeholder={catalogMatch ? '' : '0'}
        />
        <span className="text-muted-foreground text-[10px]">/ {req.uom}</span>
      </div>

      {/* Add button */}
      <Button
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={handleAdd}
        disabled={alreadyAdded || !rateValid}
        title={alreadyAdded ? 'Already in bid list' : 'Add this bid'}
      >
        {alreadyAdded ? (
          <>
            <Check className="h-3 w-3" />
            Added
          </>
        ) : (
          <>
            <Plus className="h-3 w-3" />
            Add Bid
          </>
        )}
      </Button>
    </div>
  )
}
