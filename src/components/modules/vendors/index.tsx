'use client'

import { useState, useMemo } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Search, Mountain, Building2, Package, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { BillingHoldsView } from '@/components/modules/billing-holds'
import { INITIAL_VENDORS } from '@/data/seed/vendors'
import type { Vendor, VendorCategory } from '@/lib/types/vendor'
import type {
  ScItem,
  MaterialIssue,
  ConsumableIssue,
  CustomDeductible,
} from '@/components/modules/vendors/types'
import { ProfileTab } from './profile-tab'
import { SubBoqTab } from './sub-boq-tab'
import { MaterialTab } from './material-tab'
import { ConsumablesTab } from './consumables-tab'
import { RunningBillTab } from './running-bill-tab'
import { ScheduleTab } from './schedule-tab'
import { PerformanceTab } from './performance-tab'
import { SupplyCatalogTab } from './supply-catalog-tab'
import { PurchaseHistoryTab } from './purchase-history-tab'
import { ComplianceDashboard } from './compliance-dashboard'

// ─── Category filter tabs ─────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'supplier' | 'subcontractor'

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'supplier', label: 'Suppliers' },
  { id: 'subcontractor', label: 'Subcontractors' },
]

// ─── Vendor → Subcontractor adapter ───────────────────────────────────────────
//
// The existing Sub-BOQ / Material / Consumables / Bill / Schedule / Performance
// tabs all take the legacy `Subcontractor` shape (items, materialIssues, etc.).
// The unified `Vendor` record carries the same data under slightly different
// field names (workItems vs items). This helper bridges the two so we don't
// have to rewrite every tab just to support the unified record.
//
// Insurance / labour-licence expiries live on `docs` in the Vendor record but
// on direct fields in the Subcontractor shape — we extract them by doc type.

function vendorToSc(v: Vendor): Subcontractor {
  const docs = v.docs ?? []
  const insurance = docs.find((d) => d.type === 'insurance')
  const labourLic = docs.find((d) => d.type === 'labour_licence')
  return {
    id: v.id,
    name: v.name,
    scope: v.scope ?? '',
    agreementValue: v.agreementValue ?? 0,
    advancePaid: v.advancePaid ?? 0,
    advancePct: v.advancePct ?? 0,
    advanceRecovered: v.advanceRecovered ?? 0,
    retentionPct: v.retentionPct ?? 0,
    reworkCost: v.reworkCost ?? 0,
    status: v.status === 'active' ? 'active' : 'closed',
    pan: v.pan ?? '',
    gst: v.gst ?? '',
    insuranceExpiry: insurance?.expiryDate ?? '',
    labourLicenseExpiry: labourLic?.expiryDate ?? '',
    items: v.workItems ?? [],
    materialIssues: v.materialIssues ?? [],
    materialReturns: v.materialReturns ?? [],
    consumables: v.consumables ?? [],
    customDeductibles: v.customDeductibles ?? [],
    assignedTasks: v.assignedTasks ?? [],
    ncrCount: v.ncrCount ?? 0,
    incidents: v.incidents ?? 0,
    isTunneling: v.isTunneling ?? false,
  }
}

// ─── Category badge for the left-pane list rows ──────────────────────────────

const CATEGORY_BADGE_CLASS: Record<VendorCategory, string> = {
  supplier: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  subcontractor: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  consultant: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  labour: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}

const CATEGORY_LABEL_SHORT: Record<VendorCategory, string> = {
  supplier: 'Supplier',
  subcontractor: 'SC',
  consultant: 'Consultant',
  labour: 'Labour',
}

// ─── Main Module ─────────────────────────────────────────────────────────────

export function VendorsModule() {
  const [selectedId, setSelectedId] = usePersistentState('omnisite-vendors-selected', 'SC-01')
  // Synced via /api/vendors when Supabase is configured; falls back to
  // localStorage (with INITIAL_VENDORS as the seed) when not. The fieldMap
  // maps camelCase app fields to the snake_case columns on the `vendors`
  // table (migration 00000000000010).
  const [vendors, setVendors, vendorsLoading] = useSyncedState<Vendor[]>(
    'omnisite-vendors',
    'vendors',
    () => INITIAL_VENDORS,
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
        // Cumulative advance recovered across prior bills (migration 19).
        // Without this entry the running-bill tab's recovery tally would
        // silently reset to 0 after every reload in Supabase mode.
        advanceRecovered: 'advance_recovered',
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
  // Top-level view: per-vendor inspector vs. cross-vendor compliance dashboard.
  // The compliance view reuses the same `vendors` array (no second
  // useSyncedState subscription), so writes from the inspector propagate
  // immediately to the dashboard.
  const [topView, setTopView] = useState<'vendors' | 'compliance'>('vendors')
  const [activeTab, setActiveTab] = useState('profile')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return vendors.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.scope ?? '').toLowerCase().includes(q) ||
        (v.tradeName ?? '').toLowerCase().includes(q)
      )
    })
  }, [vendors, searchQuery, categoryFilter])

  const selected = vendors.find((v) => v.id === selectedId) ?? vendors[0]

  // Sync selectedId when the fallback kicks in (audit V1-1 — same pattern
  // as BOQ B4-4, scheduler R6-6, daily-ops D1-1).
  if (selected && selected.id !== selectedId) {
    setSelectedId(selected.id)
  }

  if (vendorsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading vendors…" />
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="No vendors yet…" />
      </div>
    )
  }

  const updateVendor = (updated: Vendor) => {
    setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
  }

  // Top-level view toggle. Mirrors the daily-ops module's DSR/RFI header strip
  // so users get a consistent "module-level view switcher" pattern: a sticky
  // 44px strip with two buttons, and the active view fills the remaining space.
  // The Compliance tab passes the same `vendors` array the inspector uses, so
  // edits in one view show up immediately in the other without a refetch.
  const headerStrip = (
    <div className="vibrancy flex h-11 flex-shrink-0 items-center gap-2 border-b border-[var(--pane-divider)] px-3">
      <Button
        variant={topView === 'vendors' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setTopView('vendors')}
      >
        <Building2 className="h-3.5 w-3.5" />
        Vendors
        <span className="bg-secondary text-muted-foreground ml-1 rounded-full px-1 py-0.5 text-[11px] font-semibold">
          {vendors.length}
        </span>
      </Button>
      <Button
        variant={topView === 'compliance' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setTopView('compliance')}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Compliance
      </Button>
    </div>
  )

  if (topView === 'compliance') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {headerStrip}
        <div className="min-h-0 flex-1">
          <ComplianceDashboard vendors={vendors} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {headerStrip}
      <div className="min-h-0 flex-1">
        <Workspace2Pane
          leftPane={
            <>
              <PaneHeader title="Vendors">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() =>
                    toast.info('Vendor creation requires PM role', {
                      description: 'Open the Admin module → Vendors to create a new vendor record.',
                    })
                  }
                  title="Add vendor (Admin module)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </PaneHeader>

              {/* Category filter row */}
              <div className="border-b border-[var(--pane-divider)] px-2 py-1.5">
                <div className="flex gap-0.5">
                  {CATEGORY_FILTERS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryFilter(c.id)}
                      className={cn(
                        'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
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

              <div className="border-b border-[var(--pane-divider)] px-3 py-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    placeholder="Search vendors…"
                    className="h-8 pl-7 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <PaneBody className="py-2">
                {filtered.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={cn(
                      'w-full border-l-2 px-3 py-2 text-left',
                      selectedId === v.id
                        ? 'bg-accent border-l-primary'
                        : 'hover:bg-accent/50 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[10px]">{v.id}</span>
                      <Badge
                        variant="secondary"
                        className={cn('text-[11px]', CATEGORY_BADGE_CLASS[v.category])}
                      >
                        {v.category === 'supplier' ? (
                          <Package className="mr-0.5 h-2 w-2" />
                        ) : (
                          <Building2 className="mr-0.5 h-2 w-2" />
                        )}
                        {CATEGORY_LABEL_SHORT[v.category]}
                      </Badge>
                      {v.category === 'subcontractor' && v.isTunneling && (
                        <Badge
                          variant="secondary"
                          className="bg-violet-500/15 text-[11px] text-violet-700 dark:text-violet-300"
                        >
                          <Mountain className="mr-0.5 h-2 w-2" />
                          Tunneling
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[11px]">
                        {v.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium">{v.name}</div>
                    <div className="text-muted-foreground truncate text-[10px]">
                      {v.category === 'subcontractor'
                        ? (v.scope ?? '—')
                        : (v.tradeName ?? v.materialsSupplied?.[0]?.name ?? '—')}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="text-muted-foreground px-3 py-6 text-center text-[10px]">
                    No vendors match this filter.
                  </div>
                )}
              </PaneBody>
            </>
          }
          rightPane={
            <VendorInspector
              vendor={selected}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onChange={updateVendor}
            />
          }
          leftPaneWidth="280px"
          rightPaneWidth="500px"
        />
      </div>
    </div>
  )
}

// ─── Vendor Inspector (right pane with tabs) ──────────────────────────────────

function VendorInspector({
  vendor,
  activeTab,
  setActiveTab,
  onChange,
}: {
  vendor: Vendor
  activeTab: string
  setActiveTab: (t: string) => void
  onChange: (updated: Vendor) => void
}) {
  const isSupplier = vendor.category === 'supplier'
  const isSc = vendor.category === 'subcontractor'

  // The Sub-BOQ / Material / Consumables / Bill / Schedule / Performance tabs
  // consume the legacy Subcontractor shape — adapt the unified Vendor on the fly.
  // The inspector always reads the freshest vendor via the parent's onChange,
  // but the legacy tabs are read-only views on top of the adapted record.
  const sc = useMemo(() => vendorToSc(vendor), [vendor])

  // Tab order is category-driven per spec:
  //   supplier     → Profile | Supply Catalog | Purchase History
  //   subcontractor → Profile | Sub-BOQ | Material | Consumables | Bill | Schedule | Performance
  const tabs = isSupplier
    ? ([
        { value: 'profile', label: 'Profile' },
        { value: 'catalog', label: 'Supply Catalog' },
        { value: 'history', label: 'Purchase History' },
      ] as const)
    : ([
        { value: 'profile', label: 'Profile' },
        { value: 'subboq', label: 'Sub-BOQ' },
        { value: 'material', label: 'Material' },
        { value: 'consumables', label: 'Consumables' },
        { value: 'bill', label: 'Bill' },
        { value: 'holds', label: 'Holds' },
        { value: 'schedule', label: 'Schedule' },
        { value: 'performance', label: 'Performance' },
      ] as const)

  return (
    <>
      <PaneHeader title={`Vendor Inspector · ${vendor.id}`} />
      <PaneBody>
        {/* Header */}
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn('text-[10px]', CATEGORY_BADGE_CLASS[vendor.category])}
            >
              {CATEGORY_LABEL_SHORT[vendor.category]}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {vendor.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Rating · {vendor.rating}
            </Badge>
            {isSc && vendor.isTunneling && (
              <Badge
                variant="secondary"
                className="bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300"
              >
                <Mountain className="mr-0.5 h-2.5 w-2.5" />
                Tunneling SC
              </Badge>
            )}
          </div>
          <div className="text-sm font-semibold">{vendor.name}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {isSupplier ? (vendor.tradeName ?? '—') : (vendor.scope ?? '—')}
          </div>
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[10px]">
            <span>PAN: {vendor.pan ?? '—'}</span>
            <span>·</span>
            <span>GST: {vendor.gst ?? '—'}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-3 pt-2">
            <TabsList
              className="grid h-8 w-full text-xs"
              style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
            >
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-1 text-[11px]">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Profile tab — same fields for both categories */}
          <TabsContent value="profile" className="mt-0">
            <ProfileTab vendor={vendor} onChange={onChange} />
          </TabsContent>

          {/* Supplier-only tabs */}
          {isSupplier && (
            <TabsContent value="catalog" className="mt-0">
              <SupplyCatalogTab vendor={vendor} onChange={onChange} />
            </TabsContent>
          )}
          {isSupplier && (
            <TabsContent value="history" className="mt-0">
              <PurchaseHistoryTab vendorName={vendor.name} />
            </TabsContent>
          )}

          {/* Subcontractor-only tabs — reuse the existing tab components */}
          {isSc && (
            <>
              <TabsContent value="subboq" className="mt-0">
                <SubBoqTab
                  sc={sc}
                  onAddItem={(item: ScItem) =>
                    onChange({ ...vendor, workItems: [...(vendor.workItems ?? []), item] })
                  }
                />
              </TabsContent>
              <TabsContent value="material" className="mt-0">
                <MaterialTab
                  sc={sc}
                  onAddMaterialIssue={(issue: MaterialIssue) =>
                    onChange({
                      ...vendor,
                      materialIssues: [...(vendor.materialIssues ?? []), issue],
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="consumables" className="mt-0">
                <ConsumablesTab
                  sc={sc}
                  onAddConsumable={(issue: ConsumableIssue) =>
                    onChange({ ...vendor, consumables: [...(vendor.consumables ?? []), issue] })
                  }
                />
              </TabsContent>
              <TabsContent value="bill" className="mt-0">
                <RunningBillTab
                  sc={sc}
                  onAddDeductible={(d: CustomDeductible) =>
                    onChange({
                      ...vendor,
                      customDeductibles: [...(vendor.customDeductibles ?? []), d],
                    })
                  }
                  onUpdateAdvanceRecovered={(newTotalRecovered: number) =>
                    onChange({ ...vendor, advanceRecovered: newTotalRecovered })
                  }
                />
              </TabsContent>
              <TabsContent value="holds" className="mt-0">
                <BillingHoldsView />
              </TabsContent>
              <TabsContent value="schedule" className="mt-0">
                <ScheduleTab sc={sc} />
              </TabsContent>
              <TabsContent value="performance" className="mt-0">
                <PerformanceTab sc={sc} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </PaneBody>
    </>
  )
}

export default VendorsModule
