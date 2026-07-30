'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Users, FileText, AlertTriangle, TrendingUp, Wallet, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SC {
  id: string; name: string; scope: string; agreementValue: number; earned: number; advancePaid: number; retention: number; reworkCost: number; netPayable: number; status: 'active' | 'closed'; items: { code: string; desc: string; uom: string; rate: number; planned: number; actual: number }[]
}

const SCS: SC[] = [
  {
    id: 'SC-01', name: 'M/S Lama Constructions', scope: 'Box culvert construction (6 nos.)', agreementValue: 17_100_000, earned: 6_050_000, advancePaid: 1_710_000, retention: 605_000, reworkCost: 0, netPayable: 3_735_000, status: 'active',
    items: [
      { code: '3.2', desc: 'Box culvert 2x2m precast', uom: 'no', rate: 285000, planned: 6, actual: 2 },
      { code: '3.2.1', desc: 'Excavation for culvert', uom: 'cum', rate: 412, planned: 480, actual: 320 },
      { code: '3.2.2', desc: 'PCC M20 base', uom: 'cum', rate: 12400, planned: 36, actual: 12 },
    ],
  },
  {
    id: 'SC-02', name: 'Shrestha Steel Works', scope: 'Rebar fabrication & fixing', agreementValue: 2_183_000, earned: 1_374_600, advancePaid: 218_300, retention: 137_460, reworkCost: 24_500, netPayable: 994_340, status: 'active',
    items: [
      { code: '1.2.1', desc: 'Reinforcement steel Fe500', uom: 'MT', rate: 118000, planned: 18.5, actual: 11.65 },
    ],
  },
  {
    id: 'SC-03', name: 'Himal Pavements Pvt Ltd', scope: 'DBM & BC laying', agreementValue: 44_376_000, earned: 0, advancePaid: 4_437_600, retention: 0, reworkCost: 0, netPayable: -4_437_600, status: 'active',
    items: [
      { code: '2.2.1', desc: 'DBM 50mm layer', uom: 'sqm', rate: 1450, planned: 14200, actual: 0 },
      { code: '2.2.2', desc: 'BC 40mm wearing course', uom: 'sqm', rate: 1680, planned: 14200, actual: 0 },
    ],
  },
]

export function SubcontractorModule() {
  const [selectedId, setSelectedId] = useState('SC-01')
  const selected = SCS.find(s => s.id === selectedId) ?? SCS[0]

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Subcontractors">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search subcontractors…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            {SCS.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn('w-full text-left px-3 py-2 border-l-2', selectedId === s.id ? 'bg-accent border-l-primary' : 'border-l-transparent hover:bg-accent/50')}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                  <Badge variant="secondary" className="text-[9px]">{s.status}</Badge>
                </div>
                <div className="text-xs font-medium mt-0.5 truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.scope}</div>
              </button>
            ))}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="SC Register · 3 active">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Generate Bill</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Subcontractor</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-16 px-2">SC #</div>
            <div className="flex-1 px-2">Subcontractor</div>
            <div className="w-28 px-2 text-right">Agreement</div>
            <div className="w-28 px-2 text-right">Earned</div>
            <div className="w-24 px-2 text-right">Advance</div>
            <div className="w-24 px-2 text-right">Retention</div>
            <div className="w-24 px-2 text-right">Rework</div>
            <div className="w-28 px-2 text-right">Net Payable</div>
          </div>
          <PaneBody className="px-0">
            {SCS.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn('flex items-center h-12 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === s.id && 'bg-accent')}
              >
                <div className="w-16 px-2 font-mono text-muted-foreground">{s.id}</div>
                <div className="flex-1 px-2">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.scope}</div>
                </div>
                <div className="w-28 px-2 text-right font-mono">{(s.agreementValue / 1_000_000).toFixed(2)}M</div>
                <div className="w-28 px-2 text-right font-mono font-medium">{(s.earned / 1_000_000).toFixed(2)}M</div>
                <div className="w-24 px-2 text-right font-mono text-muted-foreground">{(s.advancePaid / 1_000_000).toFixed(2)}M</div>
                <div className="w-24 px-2 text-right font-mono text-muted-foreground">{(s.retention / 1_000).toFixed(0)}K</div>
                <div className={cn('w-24 px-2 text-right font-mono', s.reworkCost > 0 && 'text-red-500')}>{s.reworkCost > 0 ? `${(s.reworkCost / 1000).toFixed(0)}K` : '—'}</div>
                <div className={cn('w-28 px-2 text-right font-mono font-bold', s.netPayable < 0 && 'text-amber-600')}>{s.netPayable < 0 ? '-' : ''}{(Math.abs(s.netPayable) / 1_000_000).toFixed(2)}M</div>
              </div>
            ))}
          </PaneBody>
        </>
      }
      rightPane={<ScInspector sc={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function ScInspector({ sc }: { sc: SC }) {
  return (
    <>
      <PaneHeader title={`SC Inspector · ${sc.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <Badge variant="secondary" className="text-[10px]">{sc.status}</Badge>
          <div className="text-sm font-semibold mt-2">{sc.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{sc.scope}</div>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sub-BOQ / Work Order</div>
          <div className="space-y-1.5">
            {sc.items.map(it => (
              <div key={it.code} className="p-2 rounded border border-[var(--pane-divider)] text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{it.code}</span>
                  <span className="font-mono text-[10px]">{it.actual}/{it.planned} {it.uom}</span>
                </div>
                <div className="font-medium mt-0.5">{it.desc}</div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>SC rate: NPR {it.rate.toLocaleString()}/{it.uom}</span>
                  <span>Earned: NPR {(it.actual * it.rate).toLocaleString()}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(it.actual / it.planned) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Auto-Earned Value (DSR-linked)</div>
          <div className="p-2.5 rounded-md bg-secondary/40 text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Agreement value</span><span className="font-mono">NPR {(sc.agreementValue / 1_000_000).toFixed(2)}M</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Earned (DSR × SC rate)</span><span className="font-mono font-medium">NPR {(sc.earned / 1_000_000).toFixed(2)}M</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Earned %</span><span className="font-mono">{((sc.earned / sc.agreementValue) * 100).toFixed(1)}%</span></div>
          </div>

          <Separator />

          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Running Bill Computation</div>
          <div className="p-2.5 rounded-md border border-[var(--pane-divider)] text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Total earned</span><span className="font-mono">NPR {sc.earned.toLocaleString()}</span></div>
            <div className="flex justify-between text-red-600"><span className="flex items-center gap-1"><Percent className="w-3 h-3" />Advance recovery (10%)</span><span className="font-mono">- {sc.advancePaid.toLocaleString()}</span></div>
            <div className="flex justify-between text-amber-600"><span className="flex items-center gap-1"><Percent className="w-3 h-3" />Retention (10%)</span><span className="font-mono">- {sc.retention.toLocaleString()}</span></div>
            {sc.reworkCost > 0 && (
              <div className="flex justify-between text-red-600"><span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Rework recovery (NCR)</span><span className="font-mono">- {sc.reworkCost.toLocaleString()}</span></div>
            )}
            <Separator />
            <div className="flex justify-between font-bold"><span><Wallet className="w-3.5 h-3.5 inline mr-1" />Net payable</span><span className="font-mono">NPR {sc.netPayable.toLocaleString()}</span></div>
          </div>

          {sc.reworkCost > 0 && (
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
              <div>
                <div className="font-medium">Rework cost recovery active</div>
                <div className="text-muted-foreground">NCR-034 (rebar cover &lt; 40mm) deducted NPR {sc.reworkCost.toLocaleString()} from this bill. Pushed to Financials.</div>
              </div>
            </div>
          )}

          <Button className="w-full h-9 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Generate Running Bill #{Math.ceil(sc.earned / 1_000_000)}</Button>
        </div>
      </PaneBody>
    </>
  )
}
