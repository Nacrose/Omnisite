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
  Plus, Search, Truck, Fuel, Wrench, FileText, Calendar, AlertTriangle,
  CheckCircle2, User, Phone, MapPin, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'

interface Equip {
  id: string; name: string; type: string; status: 'active' | 'breakdown' | 'idle'; owned: boolean; operator?: string; licenseExp?: string;
  chargeRate: number; fuelToday?: number; hoursToday?: number; burnRate?: number; burnNorm?: number;
  rental?: { vendor: string; rate: number; terms: string[] }
  docs: { name: string; type: string; exp?: string }[]
}

const EQUIP: Equip[] = [
  {
    id: 'E-001', name: 'JCB 3DX Excavator', type: 'Excavator', status: 'active', owned: false, operator: 'Hari Bahadur', licenseExp: '2026-12-15',
    chargeRate: 1850, fuelToday: 32, hoursToday: 8, burnRate: 4.0, burnNorm: 3.5,
    rental: { vendor: 'Kathmandu Equipment Rental', rate: 1850, terms: ['Project pays fuel', 'Project pays consumables', 'Renter pays maintenance'] },
    docs: [
      { name: 'Rental Agreement', type: 'PDF' },
      { name: 'Blue Book', type: 'PDF', exp: '2027-03-15' },
      { name: 'Insurance', type: 'PDF', exp: '2026-11-30' },
    ],
  },
  {
    id: 'E-002', name: 'Tata 1109 Tipper', type: 'Tipper Truck', status: 'active', owned: false, operator: 'Suresh Tamang', licenseExp: '2027-02-20',
    chargeRate: 1200, fuelToday: 18, hoursToday: 9, burnRate: 2.0, burnNorm: 2.5,
    rental: { vendor: 'Hetauda Transport Co.', rate: 1200, terms: ['Renter pays driver salary', 'Project pays fuel', 'Renter pays major repairs'] },
    docs: [{ name: 'Rental Agreement', type: 'PDF' }, { name: 'Blue Book', type: 'PDF', exp: '2026-09-30' }],
  },
  {
    id: 'E-003', name: 'Concrete Mixer 0.4 cum', type: 'Mixer', status: 'active', owned: true, chargeRate: 285, fuelToday: 12, hoursToday: 6, burnRate: 2.0, burnNorm: 2.0,
    docs: [{ name: 'Purchase Invoice', type: 'PDF' }],
  },
  {
    id: 'E-004', name: 'Needle Vibrator 60mm', type: 'Vibrator', status: 'idle', owned: true, chargeRate: 95,
    docs: [{ name: 'Purchase Invoice', type: 'PDF' }],
  },
  {
    id: 'E-005', name: 'Batching Plant 30 cum/hr', type: 'Plant', status: 'breakdown', owned: false, operator: 'Ram Lal', licenseExp: '2026-10-12',
    chargeRate: 4200, rental: { vendor: 'Bhotahiti Concrete', rate: 4200, terms: ['Renter pays all', 'Min maint: NPR 25,000'] },
    docs: [{ name: 'Rental Agreement', type: 'PDF' }, { name: 'Insurance', type: 'PDF', exp: '2026-08-30' }],
  },
]

export function EquipmentModule() {
  const [selectedId, setSelectedId] = useState('E-001')
  const [equipList, setEquipList] = useSyncedState<Equip[]>(
    'omnisite-equipment',
    'equipment',
    () => JSON.parse(JSON.stringify(EQUIP)),
    {
      fieldMap: { chargeRate: 'charge_rate', fuelToday: 'fuel_today', hoursToday: 'hours_today', burnRate: 'burn_rate', burnNorm: 'burn_norm', licenseExp: 'license_expiry' },
      primaryKey: 'id',
    }
  ) as [Equip[], (v: Equip[] | ((prev: Equip[]) => Equip[])) => void, boolean]
  const selected = equipList.find(e => e.id === selectedId) ?? equipList[0]
  const totalCost = equipList.reduce((s, e) => s + (e.chargeRate || 0) * (e.hoursToday || 8), 0)

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Fleet Categories">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="px-3 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search fleet…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
            {['Excavator', 'Tipper Truck', 'Mixer', 'Vibrator', 'Plant', 'Compactor', 'Crane'].map(cat => {
              const count = equipList.filter(e => e.type === cat).length
              return (
                <button key={cat} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/50">
                  <span className="flex items-center gap-2"><Truck className="w-3 h-3 text-muted-foreground" />{cat}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
          </PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 text-xs space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Fleet Cost</div>
            <div className="text-lg font-bold">NPR {totalCost.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">Auto-pushed to Financials (ACWP)</div>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="Fleet Register · 5 units">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Export</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Equipment</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-16 px-2">ID</div>
            <div className="flex-1 px-2">Equipment</div>
            <div className="w-24 px-2">Type</div>
            <div className="w-20 px-2">Status</div>
            <div className="w-20 px-2">Owned/Rental</div>
            <div className="w-24 px-2 text-right">Charge Rate</div>
            <div className="w-28 px-2">Burn (l/hr)</div>
            <div className="w-32 px-2">Operator</div>
          </div>
          <PaneBody className="px-0">
            {equipList.map(e => {
              const burnAlert = e.burnRate && e.burnNorm && e.burnRate > e.burnNorm
              return (
                <div
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={cn(
                    'flex items-center h-12 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover',
                    selectedId === e.id && 'bg-accent',
                    e.status === 'breakdown' && 'bg-red-500/5'
                  )}
                >
                  <div className="w-16 px-2 font-mono text-muted-foreground">{e.id}</div>
                  <div className="flex-1 px-2">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {e.fuelToday && <><Fuel className="w-2.5 h-2.5" />{e.fuelToday}l today · {e.hoursToday}h</>}
                    </div>
                  </div>
                  <div className="w-24 px-2 text-muted-foreground">{e.type}</div>
                  <div className="w-20 px-2">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[10px]',
                      e.status === 'active' && 'text-emerald-600',
                      e.status === 'breakdown' && 'text-red-500',
                      e.status === 'idle' && 'text-slate-400'
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        e.status === 'active' && 'bg-emerald-500',
                        e.status === 'breakdown' && 'bg-red-500',
                        e.status === 'idle' && 'bg-slate-400'
                      )} />
                      {e.status}
                    </span>
                  </div>
                  <div className="w-20 px-2">
                    <Badge variant="outline" className="text-[9px]">{e.owned ? 'Owned' : 'Rental'}</Badge>
                  </div>
                  <div className="w-24 px-2 text-right font-mono">NPR {e.chargeRate.toLocaleString()}/day</div>
                  <div className="w-28 px-2">
                    {e.burnRate ? (
                      <span className={cn('font-mono', burnAlert ? 'text-red-500' : 'text-muted-foreground')}>
                        {e.burnRate} {burnAlert && <span className="text-[9px]">⚠ norm {e.burnNorm}</span>}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </div>
                  <div className="w-32 px-2 text-muted-foreground truncate">{e.operator || '—'}</div>
                </div>
              )
            })}
          </PaneBody>
        </>
      }
      rightPane={<EquipmentInspector equip={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function EquipmentInspector({ equip }: { equip: Equip }) {
  const burnAlert = equip.burnRate && equip.burnNorm && equip.burnRate > equip.burnNorm
  return (
    <>
      <PaneHeader title={`Equipment Inspector · ${equip.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{equip.type}</Badge>
            <Badge variant="secondary" className={cn('text-[10px]', equip.status === 'active' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', equip.status === 'breakdown' && 'bg-red-500/15 text-red-700 dark:text-red-300')}>{equip.status}</Badge>
            <Badge variant="secondary" className="text-[10px]">{equip.owned ? 'Owned' : 'Rental'}</Badge>
          </div>
          <div className="text-sm font-semibold">{equip.name}</div>
        </div>

        <Tabs defaultValue="ops">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 w-full text-xs">
              <TabsTrigger value="ops" className="text-[11px]">Operations</TabsTrigger>
              <TabsTrigger value="rental" className="text-[11px]">Rental Terms</TabsTrigger>
              <TabsTrigger value="docs" className="text-[11px]">Documents</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ops" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
                <div className="text-[10px] text-muted-foreground">Project Charge Rate</div>
                <div className="text-base font-bold mt-0.5">NPR {equip.chargeRate.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/day</span></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Applied to project (even owned)</div>
              </div>
              <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
                <div className="text-[10px] text-muted-foreground">Today&apos;s cost</div>
                <div className="text-base font-bold mt-0.5">NPR {(equip.chargeRate * (equip.hoursToday || 8)).toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{equip.hoursToday || 8}h × NPR {equip.chargeRate}/day</div>
              </div>
            </div>

            {equip.fuelToday && (
              <>
                <Separator />
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fuel Tracking</div>
                <div className="space-y-1.5">
                  <Row label="Fuel issued today" value={`${equip.fuelToday} l`} />
                  <Row label="Hours operated" value={`${equip.hoursToday} h`} />
                  <Row label="Burn rate" value={`${equip.burnRate} l/hr`} className={burnAlert ? 'text-red-500 font-bold' : ''} />
                  <Row label="RA Norm" value={`${equip.burnNorm} l/hr`} muted />
                </div>
                {burnAlert && (
                  <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Burn rate above RA norm</div>
                      <div className="text-muted-foreground">Possible fuel theft or excessive idling. Investigate operator log.</div>
                    </div>
                  </div>
                )}
              </>
            )}

            <Separator />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operator</div>
            {equip.operator ? (
              <div className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-semibold">{equip.operator.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{equip.operator}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />License expires {equip.licenseExp}
                  </div>
                </div>
              </div>
            ) : <div className="text-muted-foreground">No operator assigned</div>}
          </TabsContent>

          <TabsContent value="rental" className="mt-0 px-4 py-3 space-y-3 text-xs">
            {equip.rental ? (
              <>
                <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
                  <div className="text-[10px] text-muted-foreground">Vendor</div>
                  <div className="font-medium">{equip.rental.vendor}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Rental rate</div>
                  <div className="font-mono">NPR {equip.rental.rate.toLocaleString()}/day</div>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rental Terms Matrix</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    'Project pays Driver Salary',
                    'Project pays Allowance',
                    'Project pays Fuel',
                    'Project pays Consumables',
                    'Project pays Housing',
                    'Project pays Routine Maint',
                    'Project pays Major Repairs',
                  ].map(term => {
                    const checked = equip.rental.terms.some(t => t.toLowerCase().includes(term.toLowerCase().replace('project pays ', '').replace('driver salary', 'driver').split(' ')[0]))
                    return (
                      <label key={term} className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
                        <Checkbox checked={checked} />
                        <span className="text-[10px]">{term}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="p-2 rounded-md bg-secondary/40">
                  <label className="text-[10px] text-muted-foreground">Min maintenance threshold</label>
                  <Input className="h-7 mt-1 text-xs" defaultValue="NPR 25,000" />
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="font-medium">Owned equipment</div>
                <div className="text-[10px] mt-1">No rental terms. Project charge rate tracks true depreciation cost.</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="docs" className="mt-0 px-4 py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document Vault</div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="w-3 h-3" />Upload</Button>
            </div>
            {equip.docs.map((d, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)] hover:bg-accent/30 cursor-pointer">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{d.name}</div>
                  {d.exp && <div className="text-[10px] text-amber-600 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />Expires {d.exp}</div>}
                </div>
                <Badge variant="outline" className="text-[9px]">{d.type}</Badge>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

function Row({ label, value, muted, className }: { label: string; value: string; muted?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground')}>{label}</span>
      <span className={cn('font-mono', className)}>{value}</span>
    </div>
  )
}
