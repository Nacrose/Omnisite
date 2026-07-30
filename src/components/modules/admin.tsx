'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Users, Package, FileText, Zap, Edit3, Copy, Trash2, ShieldCheck, Settings as SettingsIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Cat = 'users' | 'materials' | 'vendors' | 'rates' | 'presets'

interface Material {
  code: string; name: string; uom: string; altUoms?: { uom: string; factor: number; rate: number }[]; archived?: boolean; org: boolean; projectRate?: number; rate: number;
}

const MATERIALS: Material[] = [
  { code: 'M-CEM-OPC', name: 'Cement OPC 53 Grade (Udaipur)', uom: 'Bag', rate: 918, projectRate: 920, altUoms: [{ uom: 'Ton', factor: 20, rate: 18360 }, { uom: 'Kg', factor: 0.05, rate: 0.46 }], org: true },
  { code: 'M-SAND-R', name: 'River Sand (Trishuli)', uom: 'cum', rate: 3850, projectRate: 3850, org: true },
  { code: 'M-AGG-20', name: 'Coarse Aggregate 20mm', uom: 'cum', rate: 2950, projectRate: 2950, org: true },
  { code: 'M-STEEL-TMT16', name: 'TMT Steel Fe500 16mm', uom: 'MT', rate: 118200, projectRate: 118200, org: true },
  { code: 'M-PLY-18', name: 'Shuttering Ply 18mm', uom: 'Sheet', rate: 2790, projectRate: 2790, org: true, archived: true },
]

const VENDORS = [
  { id: 'V-001', name: 'Udaipur Cement Ltd', pan: '123456789', gst: 'N/A (Nepal)', materials: ['M-CEM-OPC'], brand: 'Udaipur OPC 53', rating: 'A' },
  { id: 'V-002', name: 'Shivam Cement Pvt Ltd', pan: '987654321', gst: 'N/A', materials: ['M-CEM-OPC'], brand: 'Shivam OPC', rating: 'A-' },
  { id: 'V-003', name: 'Pashupati Steel Industries', pan: '555666777', gst: 'N/A', materials: ['M-STEEL-TMT16'], brand: 'Pashupati TMT', rating: 'A' },
  { id: 'V-004', name: 'Trishuli Sand Suppliers', pan: '111222333', gst: 'N/A', materials: ['M-SAND-R'], brand: '—', rating: 'B+' },
]

const ROLES = [
  { name: 'Site Engineer', users: 4, perms: { 'BOQ': 'Read', 'Scheduler': 'Edit', 'DSR': 'Edit', 'Procurement': 'Read', 'Financials': 'Read', 'Drawings': 'Edit' } },
  { name: 'Storekeeper', users: 2, perms: { 'BOQ': 'None', 'Scheduler': 'None', 'DSR': 'Read', 'Procurement': 'Edit', 'Financials': 'None', 'Drawings': 'Read' } },
  { name: 'Foreman', users: 6, perms: { 'BOQ': 'None', 'Scheduler': 'Read', 'DSR': 'Edit', 'Procurement': 'Read', 'Financials': 'None', 'Drawings': 'Read' } },
  { name: 'Subcontractor', users: 3, perms: { 'BOQ': 'Read own', 'Scheduler': 'Read own', 'DSR': 'Edit own', 'Procurement': 'None', 'Financials': 'Read own', 'Drawings': 'Read' } },
  { name: 'Project Manager', users: 1, perms: { 'BOQ': 'Edit', 'Scheduler': 'Edit', 'DSR': 'Edit', 'Procurement': 'Edit', 'Financials': 'Edit', 'Drawings': 'Edit' } },
]

export function AdminModule() {
  const [cat, setCat] = useState<Cat>('users')
  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Master Data">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {([
              { id: 'users' as Cat, name: 'User Management', icon: Users, count: 16 },
              { id: 'materials' as Cat, name: 'Material Master', icon: Package, count: 142 },
              { id: 'vendors' as Cat, name: 'Vendor Master', icon: FileText, count: 38 },
              { id: 'rates' as Cat, name: '3-Tier Rate Library', icon: Zap, count: 4 },
              { id: 'presets' as Cat, name: 'RA Preset Library', icon: SettingsIcon, count: 24 },
            ]).map(c => {
              const Icon = c.icon
              return (
                <button key={c.id} onClick={() => setCat(c.id)} className={cn('w-full flex items-center gap-2.5 h-9 px-3 text-xs', cat === c.id ? 'bg-accent border-l-2 border-primary' : 'hover:bg-accent/50 border-l-2 border-transparent')}>
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left">{c.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{c.count}</Badge>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={cat === 'users' ? 'User Management · PM-Centric' : cat === 'materials' ? 'Material Master · Two-tier' : cat === 'vendors' ? 'Vendor Master · AVL' : cat === 'rates' ? '3-Tier Rate Library' : 'RA Preset Library'}>
            <div className="relative w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search…" className="h-7 pl-7 text-xs" />
            </div>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />New</Button>
          </PaneHeader>

          {cat === 'users' && <UsersView />}
          {cat === 'materials' && <MaterialsView />}
          {cat === 'vendors' && <VendorsView />}
          {cat === 'rates' && <RatesView />}
          {cat === 'presets' && <PresetsView />}
        </>
      }
      rightPane={
        cat === 'users' ? <UsersInspector /> : cat === 'materials' ? <MaterialInspector /> : cat === 'vendors' ? <VendorInspector /> : cat === 'rates' ? <RateInspector /> : <PresetInspector />
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function UsersView() {
  return (
    <PaneBody className="p-4 space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pre-configured Role Templates</div>
      <div className="grid grid-cols-1 gap-2">
        {ROLES.map(r => (
          <div key={r.name} className="rounded-lg border border-[var(--pane-divider)] p-3 hover:bg-accent/30 cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm">{r.name}</div>
              <Badge variant="secondary" className="text-[10px]">{r.users} users</Badge>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {Object.entries(r.perms).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-1 rounded bg-secondary/40">
                  <span className="text-muted-foreground">{k}</span>
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1', v === 'Edit' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', v === 'None' && 'border-slate-400/40 text-muted-foreground')}>{v}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Users on Project</div>
      <div className="space-y-1.5">
        {[
          { name: 'Arjun Sharma', email: 'arjun@omnisite.com', role: 'Project Manager', status: 'Active' },
          { name: 'Bikash Rai', email: 'bikash@omnisite.com', role: 'Site Engineer', status: 'Active' },
          { name: 'Sita Gurung', email: 'sita@omnisite.com', role: 'Storekeeper', status: 'Active' },
          { name: 'Ram Bahadur', email: 'ram.b@omnisite.com', role: 'Foreman', status: 'Active' },
        ].map((u, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-semibold">{u.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{u.name}</div>
              <div className="text-[10px] text-muted-foreground">{u.email} · {u.role}</div>
            </div>
            <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{u.status}</Badge>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Invite User</Button>
    </PaneBody>
  )
}

function MaterialsView() {
  return (
    <PaneBody className="px-0">
      <div className="px-4 py-2 bg-secondary/20 text-[11px] text-muted-foreground border-b border-[var(--pane-divider)]">
        Two-tier system: <span className="font-medium text-foreground">Org Master</span> (district rates, read-only) → <span className="font-medium text-foreground">Project List</span> (editable snapshot). Soft-archive only.
      </div>
      <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
        <div className="w-28 px-2">Code</div>
        <div className="flex-1 px-2">Material</div>
        <div className="w-16 px-2">UOM</div>
        <div className="w-28 px-2 text-right">Org Rate</div>
        <div className="w-28 px-2 text-right">Project Rate</div>
        <div className="w-20 px-2">Tier</div>
        <div className="w-16 px-2 text-center">Alt UOM</div>
      </div>
      {MATERIALS.map(m => (
        <div key={m.code} className={cn('flex items-center h-10 border-b border-[var(--pane-divider)] text-xs row-hover', m.archived && 'opacity-50')}>
          <div className="w-28 px-2 font-mono text-muted-foreground">{m.code}</div>
          <div className="flex-1 px-2 font-medium flex items-center gap-1.5">
            {m.archived && <Badge variant="outline" className="text-[9px]">Archived</Badge>}
            {m.name}
          </div>
          <div className="w-16 px-2 text-muted-foreground">{m.uom}</div>
          <div className="w-28 px-2 text-right font-mono">{m.rate.toLocaleString()}</div>
          <div className="w-28 px-2 text-right font-mono font-medium text-primary">{(m.projectRate ?? m.rate).toLocaleString()}</div>
          <div className="w-20 px-2">
            <Badge variant="outline" className={cn('text-[9px]', m.org && 'border-sky-500/40 text-sky-700 dark:text-sky-300')}>{m.org ? 'Org' : 'Project'}</Badge>
          </div>
          <div className="w-16 px-2 text-center">
            {m.altUoms ? <Badge variant="secondary" className="text-[9px]">{m.altUoms.length + 1}</Badge> : <span className="text-muted-foreground/40">—</span>}
          </div>
        </div>
      ))}
    </PaneBody>
  )
}

function VendorsView() {
  return (
    <PaneBody className="px-0">
      <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
        <div className="w-16 px-2">ID</div>
        <div className="flex-1 px-2">Vendor</div>
        <div className="w-28 px-2">PAN</div>
        <div className="w-20 px-2 text-center">Rating</div>
        <div className="w-32 px-2">Brand / Material</div>
        <div className="w-16 px-2 text-center">Compliance</div>
      </div>
      {VENDORS.map(v => (
        <div key={v.id} className="flex items-center h-10 border-b border-[var(--pane-divider)] text-xs row-hover">
          <div className="w-16 px-2 font-mono text-muted-foreground">{v.id}</div>
          <div className="flex-1 px-2 font-medium">{v.name}</div>
          <div className="w-28 px-2 font-mono text-[10px] text-muted-foreground">{v.pan}</div>
          <div className="w-20 px-2 text-center">
            <Badge variant="outline" className={cn('text-[10px]', v.rating.startsWith('A') && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', v.rating.startsWith('B') && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{v.rating}</Badge>
          </div>
          <div className="w-32 px-2 text-[10px] truncate">{v.brand}</div>
          <div className="w-16 px-2 text-center"><ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto" /></div>
        </div>
      ))}
    </PaneBody>
  )
}

function RatesView() {
  return (
    <PaneBody className="p-4 space-y-3">
      <div className="rounded-lg border border-[var(--pane-divider)] overflow-hidden">
        <div className="px-3 py-2 bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier 1 · Org Baselines (District Rates · Read-only)</div>
        <div className="p-3 space-y-1.5">
          {[
            { dist: 'Kathmandu', cement: 918, sand: 3850, agg: 2950 },
            { dist: 'Lalitpur', cement: 925, sand: 3920, agg: 2980 },
            { dist: 'Bhaktapur', cement: 920, sand: 3870, agg: 2960 },
          ].map(r => (
            <div key={r.dist} className="grid grid-cols-4 gap-2 text-xs p-1.5 rounded bg-secondary/20">
              <span className="font-medium">{r.dist}</span>
              <span className="font-mono text-right">NPR {r.cement}</span>
              <span className="font-mono text-right">NPR {r.sand}</span>
              <span className="font-mono text-right">NPR {r.agg}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[var(--pane-divider)] overflow-hidden">
        <div className="px-3 py-2 bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          Tier 2 · Project Rate Library (snapshot · PM-editable inline)
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1"><Edit3 className="w-3 h-3" />Inline edit in RA Builder</Button>
        </div>
        <div className="p-3 space-y-1.5">
          {MATERIALS.slice(0, 3).map(m => (
            <div key={m.code} className="flex items-center gap-2 text-xs p-1.5 rounded border border-[var(--pane-divider)]">
              <span className="font-mono text-[10px] text-muted-foreground w-24">{m.code}</span>
              <span className="flex-1">{m.name}</span>
              <span className="text-muted-foreground line-through">NPR {m.rate}</span>
              <Input className="w-24 h-7 text-xs font-mono" defaultValue={(m.projectRate ?? m.rate).toLocaleString()} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[var(--pane-divider)] overflow-hidden">
        <div className="px-3 py-2 bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier 3 · RA Preset Library (coefficients only · current rates fetched on load)</div>
        <div className="p-3 text-[11px] text-muted-foreground">
          See Presets tab. Loading a preset fetches current Project Rates dynamically — preset stores only coefficients and logic.
        </div>
      </div>
    </PaneBody>
  )
}

function PresetsView() {
  return (
    <PaneBody className="p-4 space-y-2">
      {[
        { name: 'PCC M15 — DoR Standard 1:2:4', items: 4, used: 12 },
        { name: 'PCC M20 — Bridge Foundation', items: 4, used: 8 },
        { name: 'Reinforced Concrete Pile 600mm', items: 6, used: 3 },
        { name: 'Stone Soling 150mm', items: 3, used: 5 },
        { name: 'DBM 50mm — Pavement', items: 5, used: 2 },
      ].map((p, i) => (
        <div key={i} className="rounded-lg border border-[var(--pane-divider)] p-3 hover:bg-accent/30 cursor-pointer">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium text-sm">{p.name}</div>
            <Badge variant="secondary" className="text-[10px]">Used {p.used}×</Badge>
          </div>
          <div className="text-[11px] text-muted-foreground">{p.items} resources · coefficients &amp; logic only</div>
        </div>
      ))}
    </PaneBody>
  )
}

function UsersInspector() {
  return (
    <>
      <PaneHeader title="Role Inspector" />
      <PaneBody className="p-4">
        <div className="text-xs text-muted-foreground mb-3">Select a role to view permission matrix</div>
        <div className="p-3 rounded-md border border-[var(--pane-divider)]">
          <div className="text-sm font-semibold">Project Manager</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">1 user · Full access</div>
          <Separator className="my-2" />
          <div className="space-y-1.5 text-xs">
            {Object.entries(ROLES[4].perms).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">{v}</Badge>
              </div>
            ))}
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function MaterialInspector() {
  return (
    <>
      <PaneHeader title="Material Inspector" />
      <PaneBody className="p-4 space-y-3 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">Org Master</Badge>
          <div className="text-sm font-semibold mt-2">Cement OPC 53 Grade (Udaipur)</div>
          <div className="text-[10px] text-muted-foreground font-mono">M-CEM-OPC</div>
        </div>
        <Separator />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Alternate UOMs</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
              <span className="flex-1">Bag (primary)</span>
              <span className="font-mono">NPR 920</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
              <span className="flex-1">Ton (factor 20)</span>
              <Input className="w-24 h-7 text-xs font-mono" defaultValue={18360} />
              <button className="p-1 hover:bg-accent rounded"><Zap className="w-3 h-3 text-amber-500" /></button>
            </div>
            <div className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
              <span className="flex-1">Kg (factor 0.05)</span>
              <Input className="w-24 h-7 text-xs font-mono" defaultValue={0.46} />
              <button className="p-1 hover:bg-accent rounded"><Zap className="w-3 h-3 text-amber-500" /></button>
            </div>
          </div>
        </div>
        <Separator />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actions</div>
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Copy className="w-3.5 h-3.5" />Duplicate</Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Edit3 className="w-3.5 h-3.5" />Edit</Button>
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs justify-start gap-2 text-amber-600"><Trash2 className="w-3.5 h-3.5" />Soft Archive (no delete)</Button>
          </div>
        </div>
        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px]">
          <div className="font-medium">Duplicate detected</div>
          <div className="text-muted-foreground mt-0.5">3 materials with similar names found. Merge tool available.</div>
        </div>
      </PaneBody>
    </>
  )
}

function VendorInspector() {
  return (
    <>
      <PaneHeader title="Vendor Inspector" />
      <PaneBody className="p-4 space-y-3 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">AVL · Approved</Badge>
          <div className="text-sm font-semibold mt-2">Udaipur Cement Ltd</div>
          <div className="text-[10px] text-muted-foreground font-mono">V-001</div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground">PAN</span><span className="font-mono">123456789</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">N/A (Nepal)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rating</span><Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">A</Badge></div>
        </div>
        <Separator />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Material Catalog Mapping</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between p-2 rounded border border-[var(--pane-divider)]">
              <span className="text-[10px] font-mono text-muted-foreground">M-CEM-OPC</span>
              <span className="text-xs">Udaipur OPC 53</span>
              <span className="font-mono">NPR 920/bag</span>
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}

function RateInspector() {
  return <><PaneHeader title="Rate Library Inspector" /><PaneBody className="p-4 text-xs text-muted-foreground">Select a rate tier to inspect.</PaneBody></>
}
function PresetInspector() {
  return <><PaneHeader title="Preset Inspector" /><PaneBody className="p-4 text-xs text-muted-foreground">Select a preset to view coefficient details.</PaneBody></>
}
