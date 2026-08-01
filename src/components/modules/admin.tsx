'use client'

import { useState } from 'react'
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
  Users,
  Package,
  FileText,
  Zap,
  Edit3,
  Copy,
  Trash2,
  ShieldCheck,
  Settings as SettingsIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { confirm } from '@/components/ui/confirm-dialog'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

type Cat = 'users' | 'materials' | 'vendors' | 'rates' | 'presets'

interface Material {
  code: string
  name: string
  uom: string
  altUoms?: { uom: string; factor: number; rate: number }[]
  archived?: boolean
  org: boolean
  projectRate?: number
  rate: number
}

const MATERIALS: Material[] = [
  {
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 Grade (Udaipur)',
    uom: 'Bag',
    rate: 918,
    projectRate: 920,
    altUoms: [
      { uom: 'Ton', factor: 20, rate: 18360 },
      { uom: 'Kg', factor: 0.05, rate: 0.46 },
    ],
    org: true,
  },
  {
    code: 'M-SAND-R',
    name: 'River Sand (Trishuli)',
    uom: 'cum',
    rate: 3850,
    projectRate: 3850,
    org: true,
  },
  {
    code: 'M-AGG-20',
    name: 'Coarse Aggregate 20mm',
    uom: 'cum',
    rate: 2950,
    projectRate: 2950,
    org: true,
  },
  {
    code: 'M-STEEL-TMT16',
    name: 'TMT Steel Fe500 16mm',
    uom: 'MT',
    rate: 118200,
    projectRate: 118200,
    org: true,
  },
  {
    code: 'M-PLY-18',
    name: 'Shuttering Ply 18mm',
    uom: 'Sheet',
    rate: 2790,
    projectRate: 2790,
    org: true,
    archived: true,
  },
]

const VENDORS = [
  {
    id: 'V-001',
    name: 'Udaipur Cement Ltd',
    pan: '123456789',
    gst: 'N/A (Nepal)',
    materials: ['M-CEM-OPC'],
    brand: 'Udaipur OPC 53',
    rating: 'A',
  },
  {
    id: 'V-002',
    name: 'Shivam Cement Pvt Ltd',
    pan: '987654321',
    gst: 'N/A',
    materials: ['M-CEM-OPC'],
    brand: 'Shivam OPC',
    rating: 'A-',
  },
  {
    id: 'V-003',
    name: 'Pashupati Steel Industries',
    pan: '555666777',
    gst: 'N/A',
    materials: ['M-STEEL-TMT16'],
    brand: 'Pashupati TMT',
    rating: 'A',
  },
  {
    id: 'V-004',
    name: 'Trishuli Sand Suppliers',
    pan: '111222333',
    gst: 'N/A',
    materials: ['M-SAND-R'],
    brand: '—',
    rating: 'B+',
  },
]

const ROLES = [
  {
    name: 'Site Engineer',
    users: 4,
    perms: {
      BOQ: 'Read',
      Scheduler: 'Edit',
      DSR: 'Edit',
      Procurement: 'Read',
      Financials: 'Read',
      Drawings: 'Edit',
    },
  },
  {
    name: 'Storekeeper',
    users: 2,
    perms: {
      BOQ: 'None',
      Scheduler: 'None',
      DSR: 'Read',
      Procurement: 'Edit',
      Financials: 'None',
      Drawings: 'Read',
    },
  },
  {
    name: 'Foreman',
    users: 6,
    perms: {
      BOQ: 'None',
      Scheduler: 'Read',
      DSR: 'Edit',
      Procurement: 'Read',
      Financials: 'None',
      Drawings: 'Read',
    },
  },
  {
    name: 'Subcontractor',
    users: 3,
    perms: {
      BOQ: 'Read own',
      Scheduler: 'Read own',
      DSR: 'Edit own',
      Procurement: 'None',
      Financials: 'Read own',
      Drawings: 'Read',
    },
  },
  {
    name: 'Project Manager',
    users: 1,
    perms: {
      BOQ: 'Edit',
      Scheduler: 'Edit',
      DSR: 'Edit',
      Procurement: 'Edit',
      Financials: 'Edit',
      Drawings: 'Edit',
    },
  },
]

export function AdminModule() {
  const [cat, setCat] = useState<Cat>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState(ROLES[4])
  const [selectedMaterial, setSelectedMaterial] = useState<Material>(MATERIALS[0])
  const [selectedVendor, setSelectedVendor] = useState(VENDORS[0])
  // Compute counts from the real arrays so badges never lie.
  const totalUsers = ROLES.reduce((s, r) => s + r.users, 0)
  const CATS: { id: Cat; name: string; icon: typeof Users; count: number }[] = [
    { id: 'users', name: 'User Management', icon: Users, count: totalUsers },
    { id: 'materials', name: 'Material Master', icon: Package, count: MATERIALS.length },
    { id: 'vendors', name: 'Vendor Master', icon: FileText, count: VENDORS.length },
    { id: 'rates', name: '3-Tier Rate Library', icon: Zap, count: 3 },
    { id: 'presets', name: 'RA Preset Library', icon: SettingsIcon, count: 5 },
  ]
  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Master Data">
            <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {CATS.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 px-3 text-xs',
                    cat === c.id
                      ? 'bg-accent border-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{c.name}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {c.count}
                  </Badge>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader
            title={
              cat === 'users'
                ? 'User Management · PM-Centric'
                : cat === 'materials'
                  ? 'Material Master · Two-tier'
                  : cat === 'vendors'
                    ? 'Vendor Master · AVL'
                    : cat === 'rates'
                      ? '3-Tier Rate Library'
                      : 'RA Preset Library'
            }
          >
            <div className="relative w-40">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search…"
                className="h-7 pl-7 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button size="sm" className="h-7 gap-1.5 text-xs" disabled title="Coming soon">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </PaneHeader>

          {cat === 'users' && (
            <UsersView
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'materials' && (
            <MaterialsView
              selectedMaterial={selectedMaterial}
              onSelectMaterial={setSelectedMaterial}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'vendors' && (
            <VendorsView
              selectedVendor={selectedVendor}
              onSelectVendor={setSelectedVendor}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'rates' && <RatesView />}
          {cat === 'presets' && <PresetsView />}
        </>
      }
      rightPane={
        cat === 'users' ? (
          <UsersInspector role={selectedRole} />
        ) : cat === 'materials' ? (
          <MaterialInspector material={selectedMaterial} />
        ) : cat === 'vendors' ? (
          <VendorInspector vendor={selectedVendor} />
        ) : cat === 'rates' ? (
          <RateInspector />
        ) : (
          <PresetInspector />
        )
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function UsersView({
  selectedRole,
  onSelectRole,
  searchQuery,
}: {
  selectedRole: (typeof ROLES)[0]
  onSelectRole: (r: (typeof ROLES)[0]) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filteredRoles = ROLES.filter((r) => r.name.toLowerCase().includes(q))
  return (
    <PaneBody className="space-y-3 p-4">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Pre-configured Role Templates
      </div>
      <div className="grid grid-cols-1 gap-2">
        {filteredRoles.map((r) => (
          <div
            key={r.name}
            onClick={() => onSelectRole(r)}
            className={cn(
              'cursor-pointer rounded-lg border p-3 transition-colors',
              selectedRole.name === r.name
                ? 'border-primary bg-accent'
                : 'hover:bg-accent/30 border-[var(--pane-divider)]'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">{r.name}</div>
              <Badge variant="secondary" className="text-[10px]">
                {r.users} users
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {Object.entries(r.perms).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-secondary/40 flex items-center justify-between rounded p-1"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-4 px-1 text-[9px]',
                      v === 'Edit' &&
                        'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                      v === 'None' && 'text-muted-foreground border-slate-400/40'
                    )}
                  >
                    {v}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Active Users on Project
      </div>
      <div className="space-y-1.5">
        {[
          {
            name: 'Arjun Sharma',
            email: 'arjun@omnisite.com',
            role: 'Project Manager',
            status: 'Active',
          },
          {
            name: 'Bikash Rai',
            email: 'bikash@omnisite.com',
            role: 'Site Engineer',
            status: 'Active',
          },
          {
            name: 'Sita Gurung',
            email: 'sita@omnisite.com',
            role: 'Storekeeper',
            status: 'Active',
          },
          { name: 'Ram Bahadur', email: 'ram.b@omnisite.com', role: 'Foreman', status: 'Active' },
        ]
          .filter((u) => !q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))
          .map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-semibold text-white">
                {u.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{u.name}</div>
                <div className="text-muted-foreground text-[10px]">
                  {u.email} · {u.role}
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-[9px] text-emerald-700 dark:text-emerald-300"
              >
                {u.status}
              </Badge>
            </div>
          ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        disabled
        title="Coming soon"
      >
        <Plus className="h-3.5 w-3.5" />
        Invite User
      </Button>
    </PaneBody>
  )
}

function MaterialsView({
  selectedMaterial,
  onSelectMaterial,
  searchQuery,
}: {
  selectedMaterial: Material
  onSelectMaterial: (m: Material) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filtered = MATERIALS.filter(
    (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
  )
  const COLS: ColumnDef[] = [
    { key: 'code', label: 'Code' },
    { key: 'material', label: 'Material' },
    { key: 'uom', label: 'UOM' },
    { key: 'orgrate', label: 'Org Rate' },
    { key: 'projectrate', label: 'Project Rate' },
    { key: 'tier', label: 'Tier' },
    { key: 'altuom', label: 'Alt UOM' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'admin-materials'
  )
  return (
    <>
      <div className="bg-secondary/20 text-muted-foreground border-b border-[var(--pane-divider)] px-4 py-2 text-[11px]">
        Two-tier system: <span className="text-foreground font-medium">Org Master</span> (district
        rates, read-only) → <span className="text-foreground font-medium">Project List</span>{' '}
        (editable snapshot). Soft-archive only.
      </div>
      <StickyTableShell minWidth={800}>
        <StickyTableHeader>
          {isVisible('code') && <div className="w-28 px-2">Code</div>}
          {isVisible('material') && <div className="flex-1 px-2">Material</div>}
          {isVisible('uom') && <div className="w-16 px-2">UOM</div>}
          {isVisible('orgrate') && <div className="w-28 px-2 text-right">Org Rate</div>}
          {isVisible('projectrate') && <div className="w-28 px-2 text-right">Project Rate</div>}
          {isVisible('tier') && <div className="w-20 px-2">Tier</div>}
          {isVisible('altuom') && <div className="w-16 px-2 text-center">Alt UOM</div>}
          <div className="flex-shrink-0 pr-2">
            <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
          </div>
        </StickyTableHeader>
        <StickyTableBody>
          {filtered.map((m) => (
            <div
              key={m.code}
              onClick={() => onSelectMaterial(m)}
              className={cn(
                'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
                m.archived && 'opacity-50',
                selectedMaterial.code === m.code && 'bg-accent border-l-primary border-l-2'
              )}
            >
              {isVisible('code') && (
                <div className="text-muted-foreground w-28 px-2 font-mono">{m.code}</div>
              )}
              {isVisible('material') && (
                <div className="flex flex-1 items-center gap-1.5 px-2 font-medium">
                  {m.archived && (
                    <Badge variant="outline" className="text-[9px]">
                      Archived
                    </Badge>
                  )}
                  {m.name}
                </div>
              )}
              {isVisible('uom') && <div className="text-muted-foreground w-16 px-2">{m.uom}</div>}
              {isVisible('orgrate') && (
                <div className="w-28 px-2 text-right font-mono">{m.rate.toLocaleString()}</div>
              )}
              {isVisible('projectrate') && (
                <div className="text-primary w-28 px-2 text-right font-mono font-medium">
                  {(m.projectRate ?? m.rate).toLocaleString()}
                </div>
              )}
              {isVisible('tier') && (
                <div className="w-20 px-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px]',
                      m.org && 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                    )}
                  >
                    {m.org ? 'Org' : 'Project'}
                  </Badge>
                </div>
              )}
              {isVisible('altuom') && (
                <div className="w-16 px-2 text-center">
                  {m.altUoms ? (
                    <Badge variant="secondary" className="text-[9px]">
                      {m.altUoms.length + 1}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </StickyTableBody>
      </StickyTableShell>
    </>
  )
}

function VendorsView({
  selectedVendor,
  onSelectVendor,
  searchQuery,
}: {
  selectedVendor: (typeof VENDORS)[0]
  onSelectVendor: (v: (typeof VENDORS)[0]) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filtered = VENDORS.filter(
    (v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)
  )
  const COLS: ColumnDef[] = [
    { key: 'id', label: 'ID' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'pan', label: 'PAN' },
    { key: 'rating', label: 'Rating' },
    { key: 'brand', label: 'Brand / Material' },
    { key: 'compliance', label: 'Compliance' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'admin-vendors'
  )
  return (
    <StickyTableShell minWidth={700}>
      <StickyTableHeader>
        {isVisible('id') && <div className="w-16 px-2">ID</div>}
        {isVisible('vendor') && <div className="flex-1 px-2">Vendor</div>}
        {isVisible('pan') && <div className="w-28 px-2">PAN</div>}
        {isVisible('rating') && <div className="w-20 px-2 text-center">Rating</div>}
        {isVisible('brand') && <div className="w-32 px-2">Brand / Material</div>}
        {isVisible('compliance') && <div className="w-16 px-2 text-center">Compliance</div>}
        <div className="flex-shrink-0 pr-2">
          <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
        </div>
      </StickyTableHeader>
      <StickyTableBody>
        {filtered.map((v) => (
          <div
            key={v.id}
            onClick={() => onSelectVendor(v)}
            className={cn(
              'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
              selectedVendor.id === v.id && 'bg-accent border-l-primary border-l-2'
            )}
          >
            {isVisible('id') && (
              <div className="text-muted-foreground w-16 px-2 font-mono">{v.id}</div>
            )}
            {isVisible('vendor') && <div className="flex-1 px-2 font-medium">{v.name}</div>}
            {isVisible('pan') && (
              <div className="text-muted-foreground w-28 px-2 font-mono text-[10px]">{v.pan}</div>
            )}
            {isVisible('rating') && (
              <div className="w-20 px-2 text-center">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    v.rating.startsWith('A') &&
                      'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    v.rating.startsWith('B') &&
                      'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {v.rating}
                </Badge>
              </div>
            )}
            {isVisible('brand') && <div className="w-32 truncate px-2 text-[10px]">{v.brand}</div>}
            {isVisible('compliance') && (
              <div className="w-16 px-2 text-center">
                <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" />
              </div>
            )}
          </div>
        ))}
      </StickyTableBody>
    </StickyTableShell>
  )
}

function RatesView() {
  return (
    <PaneBody className="space-y-3 p-4">
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 1 · Org Baselines (District Rates · Read-only)
        </div>
        <div className="space-y-1.5 p-3">
          {[
            { dist: 'Kathmandu', cement: 918, sand: 3850, agg: 2950 },
            { dist: 'Lalitpur', cement: 925, sand: 3920, agg: 2980 },
            { dist: 'Bhaktapur', cement: 920, sand: 3870, agg: 2960 },
          ].map((r) => (
            <div
              key={r.dist}
              className="bg-secondary/20 grid grid-cols-4 gap-2 rounded p-1.5 text-xs"
            >
              <span className="font-medium">{r.dist}</span>
              <span className="text-right font-mono">NPR {r.cement}</span>
              <span className="text-right font-mono">NPR {r.sand}</span>
              <span className="text-right font-mono">NPR {r.agg}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 2 · Project Rate Library (snapshot · PM-editable inline)
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[10px]"
            disabled
            title="Coming soon"
          >
            <Edit3 className="h-3 w-3" />
            Inline edit in RA Builder
          </Button>
        </div>
        <div className="space-y-1.5 p-3">
          {MATERIALS.slice(0, 3).map((m) => (
            <div
              key={m.code}
              className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5 text-xs"
            >
              <span className="text-muted-foreground w-24 font-mono text-[10px]">{m.code}</span>
              <span className="flex-1">{m.name}</span>
              <span className="text-muted-foreground line-through">NPR {m.rate}</span>
              <Input
                className="h-7 w-24 font-mono text-xs"
                defaultValue={(m.projectRate ?? m.rate).toLocaleString()}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 3 · RA Preset Library (coefficients only · current rates fetched on load)
        </div>
        <div className="text-muted-foreground p-3 text-[11px]">
          See Presets tab. Loading a preset fetches current Project Rates dynamically — preset
          stores only coefficients and logic.
        </div>
      </div>
    </PaneBody>
  )
}

function PresetsView() {
  return (
    <PaneBody className="space-y-2 p-4">
      {[
        { name: 'PCC M15 — DoR Standard 1:2:4', items: 4, used: 12 },
        { name: 'PCC M20 — Bridge Foundation', items: 4, used: 8 },
        { name: 'Reinforced Concrete Pile 600mm', items: 6, used: 3 },
        { name: 'Stone Soling 150mm', items: 3, used: 5 },
        { name: 'DBM 50mm — Pavement', items: 5, used: 2 },
      ].map((p, i) => (
        <div
          key={i}
          className="hover:bg-accent/30 cursor-not-allowed cursor-pointer rounded-lg border border-[var(--pane-divider)] p-3 opacity-40"
          title="Coming soon"
          aria-disabled="true"
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-medium">{p.name}</div>
            <Badge variant="secondary" className="text-[10px]">
              Used {p.used}×
            </Badge>
          </div>
          <div className="text-muted-foreground text-[11px]">
            {p.items} resources · coefficients &amp; logic only
          </div>
        </div>
      ))}
    </PaneBody>
  )
}

function UsersInspector({ role }: { role: (typeof ROLES)[0] }) {
  return (
    <>
      <PaneHeader title="Role Inspector" />
      <PaneBody className="p-4">
        <div className="rounded-md border border-[var(--pane-divider)] p-3">
          <div className="text-sm font-semibold">{role.name}</div>
          <div className="text-muted-foreground mt-0.5 text-[10px]">
            {role.users} user{role.users !== 1 ? 's' : ''} ·{' '}
            {Object.values(role.perms).every((v) => v === 'Edit') ? 'Full access' : 'Scoped access'}
          </div>
          <Separator className="my-2" />
          <div className="space-y-1.5 text-xs">
            {Object.entries(role.perms).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px]',
                    v === 'Edit' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    v === 'None' && 'text-muted-foreground border-slate-400/40',
                    v === 'Read' && 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                  )}
                >
                  {v}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function MaterialInspector({ material: m }: { material: Material }) {
  return (
    <>
      <PaneHeader title="Material Inspector" />
      <PaneBody className="space-y-3 p-4 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">
            {m.org ? 'Org Master' : 'Project'}
          </Badge>
          {m.archived && (
            <Badge variant="outline" className="ml-1 text-[10px] text-amber-600">
              Archived
            </Badge>
          )}
          <div className="mt-2 text-sm font-semibold">{m.name}</div>
          <div className="text-muted-foreground font-mono text-[10px]">{m.code}</div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">UOM</span>
            <span className="font-mono">{m.uom}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Org Rate</span>
            <span className="font-mono">NPR {m.rate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project Rate</span>
            <span className="text-primary font-mono font-medium">
              NPR {(m.projectRate ?? m.rate).toLocaleString()}
            </span>
          </div>
        </div>
        {m.altUoms && (
          <>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                Alternate UOMs
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2">
                  <span className="flex-1">{m.uom} (primary)</span>
                  <span className="font-mono">NPR {m.rate.toLocaleString()}</span>
                </div>
                {m.altUoms.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
                  >
                    <span className="flex-1">
                      {alt.uom} (factor {alt.factor})
                    </span>
                    <Input className="h-7 w-24 font-mono text-xs" defaultValue={alt.rate} />
                    <button
                      className="hover:bg-accent rounded p-1"
                      title="Auto-calc (coming soon)"
                      disabled
                    >
                      <Zap className="h-3 w-3 text-amber-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        <Separator />
        <div>
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Actions
          </div>
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              disabled
              title="Coming soon"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              disabled
              title="Coming soon"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs text-amber-600"
              disabled
              title="Coming soon"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Soft Archive (no delete)
            </Button>
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function VendorInspector({ vendor: v }: { vendor: (typeof VENDORS)[0] }) {
  return (
    <>
      <PaneHeader title="Vendor Inspector" />
      <PaneBody className="space-y-3 p-4 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">
            AVL · Approved
          </Badge>
          <div className="mt-2 text-sm font-semibold">{v.name}</div>
          <div className="text-muted-foreground font-mono text-[10px]">{v.id}</div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">PAN</span>
            <span className="font-mono">{v.pan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST</span>
            <span className="font-mono">{v.gst}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rating</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                v.rating.startsWith('A') &&
                  'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                v.rating.startsWith('B') && 'border-amber-500/40 text-amber-700 dark:text-amber-300'
              )}
            >
              {v.rating}
            </Badge>
          </div>
        </div>
        <Separator />
        <div>
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Material Catalog Mapping
          </div>
          <div className="space-y-1.5">
            {v.materials.map((mc) => {
              const mat = MATERIALS.find((m) => m.code === mc)
              return (
                <div
                  key={mc}
                  className="flex items-center justify-between rounded border border-[var(--pane-divider)] p-2"
                >
                  <span className="text-muted-foreground font-mono text-[10px]">{mc}</span>
                  <span className="text-xs">{mat?.name ?? mc}</span>
                  <span className="font-mono">
                    NPR {(mat?.projectRate ?? mat?.rate ?? 0).toLocaleString()}
                  </span>
                </div>
              )
            })}
            <div className="text-muted-foreground text-[10px]">Brand: {v.brand}</div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function RateInspector() {
  return (
    <>
      <PaneHeader title="Rate Library Inspector" />
      <PaneBody className="text-muted-foreground p-4 text-xs">
        Select a rate tier to inspect.
      </PaneBody>
    </>
  )
}
function PresetInspector() {
  return (
    <>
      <PaneHeader title="Preset Inspector" />
      <PaneBody className="text-muted-foreground p-4 text-xs">
        Select a preset to view coefficient details.
      </PaneBody>
    </>
  )
}
