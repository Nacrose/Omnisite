'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, AlertTriangle, FileText, Package, Clock, Wallet, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { INITIAL_POS, INITIAL_GRNS } from '@/data/seed/procurement'
import type { Po, Grn } from '@/components/modules/procurement/types'

// ─── Purchase History Tab (supplier-only) ────────────────────────────────────
//
// Shows every PO and GRN raised against the selected supplier, plus summary
// cards (total business, pending payments, counts) and status filters.
//
// Data source
// -----------
// Reads POs/GRNs from the shared useSyncedState stores so the same rows the
// Procurement module writes are reflected here in real time (Supabase when
// configured, localStorage fallback otherwise).
//
// Vendor-name matching
// --------------------
// PO/GRN `vendor` strings in the seed are hand-typed short names ("Udaipur
// Cement") that don't always equal the unified vendor record's `name` ("Udaipur
// Cement Ltd"). We do a bidirectional case-insensitive substring match so the
// demo data still links up; once vendor_id FKs land on the PO/GRN rows the
// matcher can become a strict equality on the id.

interface PurchaseHistoryTabProps {
  vendorName: string
}

type PoFilter = 'all' | 'Pending' | 'Partial' | 'Delivered'
type GrnFilter = 'all' | 'Cleared' | 'Hold' | 'Awaiting'

const PO_FILTERS: { id: PoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Partial', label: 'Partial' },
  { id: 'Delivered', label: 'Delivered' },
]

const GRN_FILTERS: { id: GrnFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Cleared', label: 'Cleared' },
  { id: 'Hold', label: 'Hold' },
  { id: 'Awaiting', label: 'Awaiting' },
]

// ─── Vendor-name matcher ────────────────────────────────────────────────────

function vendorMatches(recordVendor: string, vendorName: string): boolean {
  const a = recordVendor.trim().toLowerCase()
  const b = vendorName.trim().toLowerCase()
  if (!a || !b) return false
  // Bidirectional substring — handles "Udaipur Cement" vs "Udaipur Cement Ltd".
  return a.includes(b) || b.includes(a)
}

// ─── Pay-status helpers ──────────────────────────────────────────────────────

function isHoldStatus(payStatus: Grn['payStatus']): boolean {
  // Both "Hold" and "Partial Hold" indicate payment is being withheld
  // pending 3-way match reconciliation — roll them into one bucket for the
  // pending-payment sum and the Hold filter.
  return payStatus === 'Hold' || payStatus === 'Partial Hold'
}

function grnMatchesFilter(payStatus: Grn['payStatus'], filter: GrnFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'Hold') return isHoldStatus(payStatus)
  if (filter === 'Cleared') return payStatus === 'Cleared'
  if (filter === 'Awaiting') return payStatus === 'Awaiting GRN'
  return false
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PurchaseHistoryTab({ vendorName }: PurchaseHistoryTabProps) {
  const [poFilter, setPoFilter] = useState<PoFilter>('all')
  const [grnFilter, setGrnFilter] = useState<GrnFilter>('all')

  // Read from the SAME synced stores the Procurement module writes to, so this
  // tab reflects live PO/GRN data instead of stale seed arrays.
  const [pos] = useSyncedState<Po[]>(
    'omnisite-procurement-pos',
    'purchase_orders',
    () => INITIAL_POS,
    {
      fieldMap: {
        // `grn: boolean` on the Po app type maps to the `has_grn` DB column.
        // (See the matching comment in procurement/index.tsx.)
        grn: 'has_grn',
        reqId: 'req_id',
        materialCode: 'material_code',
        poQty: 'po_qty',
      },
      primaryKey: 'id',
    }
  )
  const [grns] = useSyncedState<Grn[]>('omnisite-procurement-grns', 'grns', () => INITIAL_GRNS, {
    fieldMap: {
      poId: 'po_id',
      poQty: 'po_qty',
      grnQty: 'grn_qty',
      invoiceQty: 'invoice_qty',
      payStatus: 'pay_status',
      materialCode: 'material_code',
    },
    primaryKey: 'id',
  })

  // Filter the live PO/GRN data by this vendor's name.
  const vendorPos = useMemo(
    () => pos.filter((p) => vendorMatches(p.vendor, vendorName)),
    [pos, vendorName]
  )
  const vendorGrns = useMemo(
    () => grns.filter((g) => vendorMatches(g.vendor, vendorName)),
    [grns, vendorName]
  )

  // Summary cards
  //   - Total business done = sum of PO.value for Delivered POs
  //   - Total pending payment = sum of (rate × invoiceQty) for GRNs on Hold/Partial Hold
  //   - Total POs / GRNs = count of vendor's records
  const totalBusinessDone = vendorPos
    .filter((p) => p.status === 'Delivered')
    .reduce((s, p) => s + p.value, 0)
  const totalPendingPayment = vendorGrns
    .filter((g) => isHoldStatus(g.payStatus))
    .reduce((s, g) => s + g.rate * g.invoiceQty, 0)

  const filteredPos = vendorPos.filter((p) => (poFilter === 'all' ? true : p.status === poFilter))
  const filteredGrns = vendorGrns.filter((g) => grnMatchesFilter(g.payStatus, grnFilter))

  return (
    <div className="space-y-4 p-4 text-xs">
      {/* ─── Summary cards ─────────────────────────────────────────────── */}
      <section>
        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
          <Wallet className="h-3 w-3" /> Summary
          <span className="text-muted-foreground/70 ml-1 normal-case">· {vendorName}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard
            icon={CheckCircle2}
            label="Business Done (cleared)"
            value={`NPR ${totalBusinessDone.toLocaleString('en-IN')}`}
            tone="emerald"
            sub={`${vendorPos.filter((p) => p.status === 'Delivered').length} delivered POs`}
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Pending Payment (on hold)"
            value={`NPR ${totalPendingPayment.toLocaleString('en-IN')}`}
            tone="amber"
            sub={`${vendorGrns.filter((g) => isHoldStatus(g.payStatus)).length} held GRNs`}
          />
          <SummaryCard
            icon={FileText}
            label="Total POs"
            value={String(vendorPos.length)}
            tone="sky"
            sub={`${vendorPos.filter((p) => p.status === 'Pending').length} pending`}
          />
          <SummaryCard
            icon={Package}
            label="Total GRNs"
            value={String(vendorGrns.length)}
            tone="violet"
            sub={`${vendorGrns.filter((g) => g.payStatus === 'Cleared').length} cleared`}
          />
        </div>
      </section>

      <Separator />

      {/* ─── PO History ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            <Truck className="mr-1 inline h-3 w-3" />
            PO History
          </div>
          <FilterPills filters={PO_FILTERS} active={poFilter} onChange={setPoFilter} />
        </div>
        <div className="overflow-hidden rounded-md border border-[var(--pane-divider)]">
          {/* Header */}
          <div className="bg-secondary/40 text-muted-foreground flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <div className="w-28 px-1">PO #</div>
            <div className="w-24 px-1">Date</div>
            <div className="w-24 px-1 text-right">Value (NPR)</div>
            <div className="w-16 px-1 text-center">Items</div>
            <div className="w-20 px-1">Status</div>
            <div className="w-16 px-1 text-center">GRN</div>
          </div>
          {/* Body */}
          {filteredPos.length === 0 ? (
            <div className="text-muted-foreground p-3 text-center text-[11px]">
              No POs match this filter.
            </div>
          ) : (
            filteredPos.map((p) => (
              <div
                key={p.id}
                className="flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 last:border-b-0"
              >
                <div className="w-28 truncate px-1 font-mono text-[11px]">{p.id}</div>
                <div className="text-muted-foreground w-24 px-1 text-[11px]">{p.date}</div>
                <div className="w-24 px-1 text-right font-mono text-[11px]">
                  {p.value.toLocaleString('en-IN')}
                </div>
                <div className="w-16 px-1 text-center text-[11px]">{p.items}</div>
                <div className="w-20 px-1">
                  <PoStatusBadge status={p.status} />
                </div>
                <div className="w-16 px-1 text-center">
                  {p.grn ? (
                    <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Separator />

      {/* ─── GRN History ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            <Package className="mr-1 inline h-3 w-3" />
            GRN History
          </div>
          <FilterPills filters={GRN_FILTERS} active={grnFilter} onChange={setGrnFilter} />
        </div>
        <div className="overflow-hidden rounded-md border border-[var(--pane-divider)]">
          {/* Header */}
          <div className="bg-secondary/40 text-muted-foreground flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <div className="w-28 px-1">GRN #</div>
            <div className="w-28 px-1">PO Link</div>
            <div className="min-w-0 flex-1 px-1">Vendor</div>
            <div className="w-20 px-1 text-right">Qty Recd</div>
            <div className="w-24 px-1">Pay Status</div>
            <div className="w-20 px-1">Date</div>
          </div>
          {/* Body */}
          {filteredGrns.length === 0 ? (
            <div className="text-muted-foreground p-3 text-center text-[11px]">
              No GRNs match this filter.
            </div>
          ) : (
            filteredGrns.map((g) => (
              <div
                key={g.id}
                className="flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 last:border-b-0"
              >
                <div className="w-28 truncate px-1 font-mono text-[11px]">{g.id}</div>
                <div className="text-muted-foreground w-28 truncate px-1 font-mono text-[11px]">
                  {g.poId}
                </div>
                <div className="min-w-0 flex-1 truncate px-1 text-[11px]">{g.vendor}</div>
                <div className="w-20 px-1 text-right font-mono text-[11px]">
                  {g.grnQty.toLocaleString('en-IN')}
                </div>
                <div className="w-24 px-1">
                  <GrnPayStatusBadge payStatus={g.payStatus} />
                </div>
                <div className="text-muted-foreground w-20 px-1 text-[11px]">{g.date}</div>
              </div>
            ))
          )}
        </div>
        <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[10px]">
          <Clock className="h-3 w-3" />
          PO and GRN data is read from the shared procurement store (useSyncedState) — reflects live
          data when Supabase is configured.
        </div>
      </section>
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Wallet
  label: string
  value: string
  sub?: string
  tone: 'emerald' | 'amber' | 'sky' | 'violet'
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    sky: 'border-sky-500/30 bg-sky-500/5',
    violet: 'border-violet-500/30 bg-violet-500/5',
  }
  const iconTone: Record<typeof tone, string> = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
  }
  return (
    <div className={cn('rounded-md border p-2.5', toneClass[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3 w-3', iconTone[tone])} />
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {label}
        </div>
      </div>
      <div className="mt-1 font-mono text-[13px] font-semibold">{value}</div>
      {sub && <div className="text-muted-foreground mt-0.5 text-[10px]">{sub}</div>}
    </div>
  )
}

function FilterPills<T extends string>({
  filters,
  active,
  onChange,
}: {
  filters: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-0.5">
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
            active === f.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

function PoStatusBadge({ status }: { status: Po['status'] }) {
  const cls =
    status === 'Delivered'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : status === 'Pending'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
  return (
    <Badge variant="secondary" className={cn('text-[10px]', cls)}>
      {status}
    </Badge>
  )
}

function GrnPayStatusBadge({ payStatus }: { payStatus: Grn['payStatus'] }) {
  const cls =
    payStatus === 'Cleared'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : payStatus === 'Awaiting GRN'
        ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
        : isHoldStatus(payStatus)
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
  return (
    <Badge variant="secondary" className={cn('text-[10px]', cls)}>
      {payStatus}
    </Badge>
  )
}
