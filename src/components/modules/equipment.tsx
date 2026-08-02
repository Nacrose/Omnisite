'use client'

import { useState, useRef } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Truck,
  Fuel,
  Wrench,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { uploadFile, STORAGE_BUCKETS } from '@/lib/storage'
import { useApp } from '@/lib/app-store'
import { isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'

interface Equip {
  id: string
  name: string
  type: string
  status: 'active' | 'breakdown' | 'idle'
  owned: boolean
  operator?: string
  licenseExp?: string
  chargeRate: number
  fuelToday?: number
  hoursToday?: number
  burnRate?: number
  burnNorm?: number
  rental?: { vendor: string; rate: number; terms: string[] }
  docs: { name: string; type: string; exp?: string }[]
}

const EQUIP: Equip[] = [
  {
    id: 'E-001',
    name: 'JCB 3DX Excavator',
    type: 'Excavator',
    status: 'active',
    owned: false,
    operator: 'Hari Bahadur',
    licenseExp: '2026-12-15',
    chargeRate: 1850,
    fuelToday: 32,
    hoursToday: 8,
    burnRate: 4.0,
    burnNorm: 3.5,
    rental: {
      vendor: 'Kathmandu Equipment Rental',
      rate: 1850,
      terms: ['Project pays fuel', 'Project pays consumables', 'Renter pays maintenance'],
    },
    docs: [
      { name: 'Rental Agreement', type: 'PDF' },
      { name: 'Blue Book', type: 'PDF', exp: '2027-03-15' },
      { name: 'Insurance', type: 'PDF', exp: '2026-11-30' },
    ],
  },
  {
    id: 'E-002',
    name: 'Tata 1109 Tipper',
    type: 'Tipper Truck',
    status: 'active',
    owned: false,
    operator: 'Suresh Tamang',
    licenseExp: '2027-02-20',
    chargeRate: 1200,
    fuelToday: 18,
    hoursToday: 9,
    burnRate: 2.0,
    burnNorm: 2.5,
    rental: {
      vendor: 'Hetauda Transport Co.',
      rate: 1200,
      terms: ['Renter pays driver salary', 'Project pays fuel', 'Renter pays major repairs'],
    },
    docs: [
      { name: 'Rental Agreement', type: 'PDF' },
      { name: 'Blue Book', type: 'PDF', exp: '2026-09-30' },
    ],
  },
  {
    id: 'E-003',
    name: 'Concrete Mixer 0.4 cum',
    type: 'Mixer',
    status: 'active',
    owned: true,
    chargeRate: 285,
    fuelToday: 12,
    hoursToday: 6,
    burnRate: 2.0,
    burnNorm: 2.0,
    docs: [{ name: 'Purchase Invoice', type: 'PDF' }],
  },
  {
    id: 'E-004',
    name: 'Needle Vibrator 60mm',
    type: 'Vibrator',
    status: 'idle',
    owned: true,
    chargeRate: 95,
    docs: [{ name: 'Purchase Invoice', type: 'PDF' }],
  },
  {
    id: 'E-005',
    name: 'Batching Plant 30 cum/hr',
    type: 'Plant',
    status: 'breakdown',
    owned: false,
    operator: 'Ram Lal',
    licenseExp: '2026-10-12',
    chargeRate: 4200,
    rental: {
      vendor: 'Bhotahiti Concrete',
      rate: 4200,
      terms: ['Renter pays all', 'Min maint: NPR 25,000'],
    },
    docs: [
      { name: 'Rental Agreement', type: 'PDF' },
      { name: 'Insurance', type: 'PDF', exp: '2026-08-30' },
    ],
  },
]

/**
 * Effective billed hours for a piece of equipment.
 * Only active equipment bills for 8 hours; idle/breakdown equipment costs 0
 * (previously defaulted to 8 via `|| 8`, inflating daily cost by ~NPR 34K).
 */
function effectiveHours(e: Equip): number {
  return e.hoursToday ?? (e.status === 'active' ? 8 : 0)
}

export function EquipmentModule() {
  const [selectedId, setSelectedId] = useState('E-001')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [equipList, setEquipList, equipLoading] = useSyncedState<Equip[]>(
    'omnisite-equipment',
    'equipment',
    () => structuredClone(EQUIP) as typeof EQUIP,
    {
      fieldMap: {
        chargeRate: 'charge_rate',
        fuelToday: 'fuel_today',
        hoursToday: 'hours_today',
        burnRate: 'burn_rate',
        burnNorm: 'burn_norm',
        licenseExp: 'license_expiry',
      },
      primaryKey: 'id',
    }
  )
  const selected = equipList.find((e) => e.id === selectedId) ?? equipList[0]
  // Only bill active equipment for hours. Idle/breakdown equipment costs 0
  // (previously defaulted to 8 hours via `|| 8`, inflating the daily cost by
  // ~NPR 34K).
  const totalCost = equipList.reduce((s, e) => s + (e.chargeRate || 0) * effectiveHours(e), 0)

  // Derive categories from the actual equipment list so empty categories
  // (e.g. 'Compactor', 'Crane' — none in seed) never show. 'All' is always
  // first and aggregates every equipment type.
  const allCategories = ['All', ...Array.from(new Set(equipList.map((e) => e.type)))]
  const visibleCategories = searchQuery.trim()
    ? allCategories.filter((cat) => {
        if (cat === 'All') return true
        const q = searchQuery.toLowerCase()
        if (cat.toLowerCase().includes(q)) return true
        return equipList.some(
          (e) =>
            e.type === cat &&
            (e.name.toLowerCase().includes(q) ||
              e.id.toLowerCase().includes(q) ||
              e.type.toLowerCase().includes(q))
        )
      })
    : allCategories

  const selectCategory = (cat: string) => {
    setSelectedCategory(cat)
    if (cat !== 'All') {
      const firstInCat = equipList.find((e) => e.type === cat)
      if (firstInCat) setSelectedId(firstInCat.id)
    }
  }

  if (equipLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading equipment…" />
      </div>
    )
  }

  // Guard against an empty equipment list (e.g. fresh install with no seed
  // data, or all equipment deleted). Without this, `selected` is undefined
  // and `<EquipmentInspector equip={selected} />` below would crash
  // dereferencing `equip.id` / `equip.type`. Placed AFTER all hooks have
  // been called so we don't violate rules-of-hooks.
  if (!selected) {
    return (
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Fleet Categories" />
            <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
              No items to display
            </PaneBody>
          </>
        }
        rightPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        leftPaneWidth="240px"
        rightPaneWidth="380px"
      />
    )
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Fleet Categories">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info(
                  'Equipment creation coming soon — add equipment via the API or contact admin.'
                )
              }
              title="Add equipment (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="mb-2 px-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search fleet…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {visibleCategories.map((cat) => {
              const count =
                cat === 'All' ? equipList.length : equipList.filter((e) => e.type === cat).length
              return (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                    selectedCategory === cat
                      ? 'bg-accent border-l-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Truck className="text-muted-foreground h-3 w-3" />
                    {cat}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {count}
                  </Badge>
                </button>
              )
            })}
          </PaneBody>
          <div className="space-y-1 border-t border-[var(--pane-divider)] p-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Today&apos;s fleet cost
            </div>
            <div className="text-lg font-bold">NPR {totalCost.toLocaleString()}</div>
          </div>
        </>
      }
      rightPane={<EquipmentInspector equip={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function EquipmentInspector({ equip }: { equip: Equip }) {
  const { activeProjectDbId } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Reuse the DSR photos bucket for equipment docs — there's no dedicated
  // equipment-documents bucket yet, and the access semantics (project-scoped,
  // readable by all project members) match DSR photos closely enough.
  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
  const ACCEPTED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
  const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return

    const lowerName = file.name.toLowerCase()
    const extOk = ACCEPTED_EXTS.some((ext) => lowerName.endsWith(ext))
    if (!extOk || !ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type', {
        description: 'Allowed types: PDF, PNG, JPEG, WebP.',
      })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File too large', {
        description: `Max size is 25 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      })
      return
    }
    if (!isSupabaseConfigured()) {
      toast.error('Storage not configured', {
        description:
          'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable uploads.',
      })
      return
    }

    setUploading(true)
    try {
      // Namespace by project + equipment id so docs don't collide across
      // projects or equipment.
      const folder = `${activeProjectDbId ?? 'unscoped'}/${equip.id}`
      const result = await uploadFile(STORAGE_BUCKETS.DSR_PHOTOS, file, folder)
      if (result.error) {
        toast.error('Upload failed', { description: result.error })
      } else {
        toast.success('Equipment document uploaded', {
          description: `${file.name} stored under ${equip.id} (dsr-photos bucket).`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Upload failed', { description: msg })
    } finally {
      setUploading(false)
    }
  }

  const burnAlert = equip.burnRate && equip.burnNorm && equip.burnRate > equip.burnNorm
  return (
    <>
      <PaneHeader title={`Equipment Inspector · ${equip.id}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {equip.type}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                equip.status === 'active' &&
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                equip.status === 'breakdown' && 'bg-red-500/15 text-red-700 dark:text-red-300'
              )}
            >
              {equip.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {equip.owned ? 'Owned' : 'Rental'}
            </Badge>
          </div>
          <div className="text-sm font-semibold">{equip.name}</div>
        </div>

        <Tabs defaultValue="ops">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full grid-cols-3 text-xs">
              <TabsTrigger value="ops" className="text-[11px]">
                Operations
              </TabsTrigger>
              <TabsTrigger value="rental" className="text-[11px]">
                Rental Terms
              </TabsTrigger>
              <TabsTrigger value="docs" className="text-[11px]">
                Documents
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ops" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-[var(--pane-divider)] p-2.5">
                <div className="text-muted-foreground text-[10px]">Project Charge Rate</div>
                <div className="mt-0.5 text-base font-bold">
                  NPR {equip.chargeRate.toLocaleString()}
                  <span className="text-muted-foreground text-xs font-normal">/day</span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px]">
                  Applied to project (even owned)
                </div>
              </div>
              <div className="rounded-md border border-[var(--pane-divider)] p-2.5">
                <div className="text-muted-foreground text-[10px]">Today&apos;s cost</div>
                <div className="mt-0.5 text-base font-bold">
                  NPR {(equip.chargeRate * effectiveHours(equip)).toLocaleString()}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px]">
                  {effectiveHours(equip)}h × NPR {equip.chargeRate}/day
                </div>
              </div>
            </div>

            {equip.fuelToday && (
              <>
                <Separator />
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Fuel Tracking
                </div>
                <div className="space-y-1.5">
                  <Row label="Fuel issued today" value={`${equip.fuelToday} l`} />
                  <Row label="Hours operated" value={`${equip.hoursToday} h`} />
                  <Row
                    label="Burn rate"
                    value={`${equip.burnRate} l/hr`}
                    className={burnAlert ? 'font-bold text-red-500' : ''}
                  />
                  <Row label="RA Norm" value={`${equip.burnNorm} l/hr`} muted />
                </div>
                {burnAlert && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-red-500" />
                    <div>
                      <div className="font-medium">Burn rate above RA norm</div>
                      <div className="text-muted-foreground">
                        Possible fuel theft or excessive idling. Investigate operator log.
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <Separator />
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Operator
            </div>
            {equip.operator ? (
              <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-semibold text-white">
                  {equip.operator.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{equip.operator}</div>
                  <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    License expires {equip.licenseExp}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">No operator assigned</div>
            )}
          </TabsContent>

          <TabsContent value="rental" className="mt-0 space-y-3 px-4 py-3 text-xs">
            {equip.rental ? (
              <>
                <div className="rounded-md border border-[var(--pane-divider)] p-2.5">
                  <div className="text-muted-foreground text-[10px]">Vendor</div>
                  <div className="font-medium">{equip.rental.vendor}</div>
                  <div className="text-muted-foreground mt-1 text-[10px]">Rental rate</div>
                  <div className="font-mono">NPR {equip.rental.rate.toLocaleString()}/day</div>
                </div>
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Rental Terms Matrix
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    'Project pays Driver Salary',
                    'Project pays Allowance',
                    'Project pays Fuel',
                    'Project pays Consumables',
                    'Project pays Housing',
                    'Project pays Routine Maint',
                    'Project pays Major Repairs',
                  ].map((term) => {
                    // Simple keyword match — strip the "Project pays " /
                    // "Renter pays " prefix to get the meaningful keyword,
                    // then check if any rental term mentions that keyword
                    // (case-insensitive). This replaces the previous fragile
                    // normalizeTerm() that aggressively rewrote
                    // "Driver Salary" → "Driver" and required exact full-phrase
                    // equality.
                    const keyword = term
                      .toLowerCase()
                      .replace(/^(project|renter)\s+pays\s+/, '')
                      .trim()
                    const checked = (equip.rental?.terms || []).some((t) =>
                      t.toLowerCase().includes(keyword)
                    )
                    return (
                      <label
                        key={term}
                        className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5"
                      >
                        <Checkbox checked={checked} />
                        <span className="text-[10px]">{term}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="bg-secondary/40 rounded-md p-2">
                  <label className="text-muted-foreground text-[10px]">
                    Min maintenance threshold
                  </label>
                  <Input className="mt-1 h-7 text-xs" defaultValue="NPR 25,000" />
                </div>
              </>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Truck className="mx-auto mb-2 h-8 w-8 opacity-30" />
                <div className="font-medium">Owned equipment</div>
                <div className="mt-1 text-[10px]">
                  No rental terms. Project charge rate tracks true depreciation cost.
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-0 space-y-2 px-4 py-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Document Vault
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Upload a document (PDF, PNG, JPEG, WebP — max 25 MB)"
              >
                <Plus className="h-3 w-3" />
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
            {equip.docs.map((d, i) => (
              <div
                key={i}
                className="hover:bg-accent/30 flex cursor-pointer items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
              >
                <FileText className="text-muted-foreground h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{d.name}</div>
                  {d.exp && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600">
                      <Calendar className="h-2.5 w-2.5" />
                      Expires {d.exp}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {d.type}
                </Badge>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

function Row({
  label,
  value,
  muted,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground')}>{label}</span>
      <span className={cn('font-mono', className)}>{value}</span>
    </div>
  )
}
