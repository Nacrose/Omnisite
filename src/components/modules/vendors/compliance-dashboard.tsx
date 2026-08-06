'use client'

// ─── Vendor Compliance Dashboard ─────────────────────────────────────────────
//
// Cross-vendor compliance posture at a glance. Shows every vendor (filtered by
// category) with the status of their four core compliance documents —
// insurance, labour licence, PAN, GST — and an overall traffic light derived
// from the worst-case doc status.
//
// Status rules (per the task spec):
//   • Green  — every required doc is present and not expired.
//   • Amber  — a doc expires within 30 days (but is not yet expired).
//   • Red    — a doc is expired OR missing.
//
// The four doc types are checked uniformly across all vendor categories. In
// the seed data, suppliers don't carry insurance / labour_licence and
// subcontractors don't carry gst_cert — those rows will legitimately surface
// as Red, which is the desired "gap" signal for the PM.
//
// Data source
// -----------
// Vendors are passed in as a prop from the parent VendorsModule, which owns
// the single `useSyncedState('omnisite-vendors', …)` instance. This keeps the
// dashboard read-only and avoids a second hook subscription that would
// double-fetch the same table.
//
// Sort order
// ----------
// Red first (most urgent), then Amber, then Green — so the PM's eye lands on
// the vendors that need attention today. Within a status bucket, vendors are
// kept in their original seed/store order for a stable UI.

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ShieldCheck,
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  FileText,
  Package,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Vendor, VendorCategory, ComplianceDoc } from '@/lib/types/vendor'

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'supplier' | 'subcontractor'

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'supplier', label: 'Suppliers' },
  { id: 'subcontractor', label: 'Subcontractors' },
]

/** Per-doc compliance state, derived from the doc's expiryDate. */
type DocStatus = 'ok' | 'expiring' | 'expired' | 'missing'

/** Roll-up of all four docs into a single traffic-light value. */
type OverallStatus = 'green' | 'amber' | 'red'

// ─── Compliance evaluation ───────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000
/** A doc expiring within this many days is flagged Amber. */
const AMBER_WINDOW_DAYS = 30

/** The four doc types the dashboard tracks. Order is fixed for table layout. */
const TRACKED_DOC_TYPES: ComplianceDoc['type'][] = [
  'insurance',
  'labour_licence',
  'gst_cert',
  'pan_card',
]

/** Find a doc of the given type on a vendor (returns undefined if not present). */
function findDoc(vendor: Vendor, type: ComplianceDoc['type']): ComplianceDoc | undefined {
  return (vendor.docs ?? []).find((d) => d.type === type)
}

/**
 * Derive a doc's status from its expiry date.
 *   - missing  → no doc row at all (or unparseable expiry)
 *   - ok       → present and either has no expiry (indefinite) or > 30 days out
 *   - expiring → present and expiring within 30 days
 *   - expired  → present and past its expiry date
 */
function docStatus(doc: ComplianceDoc | undefined): DocStatus {
  if (!doc) return 'missing'
  if (!doc.expiryDate) return 'ok' // no expiry → indefinite (e.g. PAN card)
  const t = Date.parse(doc.expiryDate)
  if (Number.isNaN(t)) return 'missing'
  const daysTo = (t - Date.now()) / MS_PER_DAY
  if (daysTo < 0) return 'expired'
  if (daysTo <= AMBER_WINDOW_DAYS) return 'expiring'
  return 'ok'
}

/**
 * Roll all four doc statuses up into one traffic-light value.
 * Red short-circuits on the first expired / missing doc; Amber is sticky
 * once any doc is expiring.
 */
function overallStatus(vendor: Vendor): OverallStatus {
  let sawExpiring = false
  for (const t of TRACKED_DOC_TYPES) {
    const s = docStatus(findDoc(vendor, t))
    if (s === 'expired' || s === 'missing') return 'red'
    if (s === 'expiring') sawExpiring = true
  }
  return sawExpiring ? 'amber' : 'green'
}

/** Sort rank — lower comes first in the table. */
const STATUS_RANK: Record<OverallStatus, number> = {
  red: 0,
  amber: 1,
  green: 2,
}

// ─── Presentation tokens ─────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<VendorCategory, string> = {
  supplier: 'Supplier',
  subcontractor: 'Subcontractor',
  consultant: 'Consultant',
  labour: 'Labour Gang',
}

const CATEGORY_BADGE_CLASS: Record<VendorCategory, string> = {
  supplier: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  subcontractor: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  consultant: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  labour: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}

const DOC_STATUS_DOT: Record<DocStatus, string> = {
  ok: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  missing: 'bg-slate-400',
}

const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  ok: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  missing: 'Missing',
}

const OVERALL_DOT: Record<OverallStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

const OVERALL_LABEL: Record<OverallStatus, string> = {
  green: 'Compliant',
  amber: 'Attn. req.',
  red: 'Action req.',
}

/** Format an ISO date string (YYYY-MM-DD) as DD Mon YYYY for display. */
function formatExpiry(iso?: string): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ComplianceDashboardProps {
  /** Vendors from the parent module's useSyncedState store. */
  vendors: Vendor[]
}

export function ComplianceDashboard({ vendors }: ComplianceDashboardProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  // Filter by category, then attach each vendor's overall status for the
  // sort + summary computations.
  const rows = useMemo(() => {
    return vendors
      .filter((v) => categoryFilter === 'all' || v.category === categoryFilter)
      .map((v) => ({ vendor: v, overall: overallStatus(v) }))
      .sort((a, b) => STATUS_RANK[a.overall] - STATUS_RANK[b.overall])
  }, [vendors, categoryFilter])

  // Headline counts across the FULL vendor set (not the filtered subset) so
  // the red / amber / green chips stay stable as the user toggles filters.
  // The chips are scoped to the active filter below — these are the
  // pre-filter totals shown next to the filter pills.
  const counts = useMemo(() => {
    let red = 0,
      amber = 0,
      green = 0
    for (const v of vendors) {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) continue
      const s = overallStatus(v)
      if (s === 'red') red++
      else if (s === 'amber') amber++
      else green++
    }
    return { red, amber, green }
  }, [vendors, categoryFilter])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 p-5">
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="text-primary h-4 w-4" />
              Vendor Compliance Dashboard
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Traffic-light view of every vendor's compliance documents. Red = expired or missing ·
              Amber = expiring within {AMBER_WINDOW_DAYS} days · Green = all docs valid.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Traffic-light roll-up chips */}
            <div className="bg-card flex items-center gap-3 rounded-md border border-[var(--pane-divider)] px-3 py-1.5 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                <span className="font-mono font-semibold tabular-nums">{counts.red}</span>
                <span className="text-muted-foreground">red</span>
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-mono font-semibold tabular-nums">{counts.amber}</span>
                <span className="text-muted-foreground">amber</span>
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono font-semibold tabular-nums">{counts.green}</span>
                <span className="text-muted-foreground">green</span>
              </span>
            </div>
          </div>
        </div>

        {/* ─── Filter pills ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Category
          </span>
          <div className="flex gap-0.5">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  categoryFilter === c.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* ─── Compliance table ────────────────────────────────────────── */}
        {rows.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-xs">
            No vendors match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--pane-divider)]">
            <table className="w-full min-w-[1100px] border-collapse text-[11px]">
              {/* Header row */}
              <thead>
                <tr className="bg-secondary/40 text-muted-foreground border-b border-[var(--pane-divider)] text-[10px] font-semibold tracking-wider uppercase">
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Insurance
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Labour Licence
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left">PAN</th>
                  <th className="px-3 py-2 text-left">GST</th>
                  <th className="px-3 py-2 text-center">Overall</th>
                </tr>
              </thead>
              {/* Body */}
              <tbody>
                {rows.map(({ vendor, overall }) => {
                  const insurance = findDoc(vendor, 'insurance')
                  const labour = findDoc(vendor, 'labour_licence')
                  const pan = findDoc(vendor, 'pan_card')
                  const gst = findDoc(vendor, 'gst_cert')
                  return (
                    <tr
                      key={vendor.id}
                      className="hover:bg-accent/30 border-b border-[var(--pane-divider)] last:border-b-0"
                    >
                      {/* Vendor name */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {vendor.id}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{vendor.name}</div>
                            <div className="text-muted-foreground truncate text-[10px]">
                              {vendor.tradeName ?? vendor.scope ?? '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Category */}
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px]', CATEGORY_BADGE_CLASS[vendor.category])}
                        >
                          {vendor.category === 'supplier' ? (
                            <Package className="mr-0.5 h-2 w-2" />
                          ) : (
                            <Building2 className="mr-0.5 h-2 w-2" />
                          )}
                          {CATEGORY_LABEL[vendor.category]}
                        </Badge>
                      </td>
                      {/* Insurance — status + expiry */}
                      <td className="px-3 py-2">
                        <DocStatusCell
                          status={docStatus(insurance)}
                          sub={formatExpiry(insurance?.expiryDate)}
                        />
                      </td>
                      {/* Labour Licence — status + expiry */}
                      <td className="px-3 py-2">
                        <DocStatusCell
                          status={docStatus(labour)}
                          sub={formatExpiry(labour?.expiryDate)}
                        />
                      </td>
                      {/* PAN — status only */}
                      <td className="px-3 py-2">
                        <DocStatusCell status={docStatus(pan)} sub={pan ? 'on file' : undefined} />
                      </td>
                      {/* GST — status only */}
                      <td className="px-3 py-2">
                        <DocStatusCell status={docStatus(gst)} sub={gst ? 'on file' : undefined} />
                      </td>
                      {/* Overall traffic light */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className={cn(
                              'inline-block h-2.5 w-2.5 rounded-full',
                              OVERALL_DOT[overall]
                            )}
                            title={OVERALL_LABEL[overall]}
                          />
                          <span className="text-[10px] font-medium">{OVERALL_LABEL[overall]}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Legend / footer ─────────────────────────────────────────── */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-[10px]">
          <span className="font-semibold tracking-wider uppercase">Legend</span>
          {(['ok', 'expiring', 'expired', 'missing'] as DocStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', DOC_STATUS_DOT[s])} />
              {DOC_STATUS_LABEL[s]}
            </span>
          ))}
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1.5">
            <CircleAlert className="h-3 w-3 text-red-500" />
            Action required
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Attention required
          </span>
          <span className="flex items-center gap-1.5">
            <CircleCheck className="h-3 w-3 text-emerald-500" />
            Compliant
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────────

/** A status dot + label + optional sub-line (used for the per-doc columns). */
function DocStatusCell({ status, sub }: { status: DocStatus; sub?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn('inline-block h-2 w-2 flex-shrink-0 rounded-full', DOC_STATUS_DOT[status])}
        title={DOC_STATUS_LABEL[status]}
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium">{DOC_STATUS_LABEL[status]}</div>
        {sub && <div className="text-muted-foreground text-[10px]">{sub}</div>}
      </div>
    </div>
  )
}

export default ComplianceDashboard
