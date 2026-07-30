'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  Plus, Copy, Camera, Cloud, Users, Clock, Truck, Fuel, Mail,
  AlertTriangle, Mountain, Thermometer, Droplets, Wind,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function DailySiteLogView() {
  return (
    <>
      <PaneHeader title="Daily Site Log · 30 July 2026">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Copy className="w-3.5 h-3.5" />Copy Yesterday</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Camera className="w-3.5 h-3.5" />Photo</Button>
      </PaneHeader>
      <PaneBody className="p-4 space-y-4">
        {/* Weather */}
        <Card title="Weather" icon={<Cloud className="w-4 h-4" />}>
          <div className="grid grid-cols-4 gap-3 text-center">
            <WeatherCell icon={<Thermometer className="w-4 h-4" />} label="Max" value="28°C" />
            <WeatherCell icon={<Thermometer className="w-4 h-4" />} label="Min" value="18°C" />
            <WeatherCell icon={<Droplets className="w-4 h-4" />} label="Rain" value="2.4mm" />
            <WeatherCell icon={<Wind className="w-4 h-4" />} label="Wind" value="12 km/h" />
          </div>
          <div className="mt-3 flex gap-2">
            <Input className="text-xs h-8" placeholder="Sky condition (clear / overcast / rainy)…" defaultValue="Partly cloudy, light rain afternoon" />
          </div>
        </Card>

        {/* Visitors */}
        <Card title="Visitors" icon={<Users className="w-4 h-4" />}>
          <div className="space-y-1.5">
            {[
              { name: 'Er. Suresh Maharjan', org: 'DoR — Supervision Consultant', purpose: 'PCC pour inspection', time: '10:30' },
              { name: 'Mr. David Rai', org: 'Client Rep — DoR', purpose: 'Monthly progress review', time: '14:00' },
            ].map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded border border-[var(--pane-divider)]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-[10px] font-semibold">{v.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">{v.org} · {v.purpose}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">{v.time}</div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 w-full"><Plus className="w-3 h-3" />Add visitor</Button>
          </div>
        </Card>

        {/* Delays */}
        <Card title="Delays / Interruptions" icon={<Clock className="w-4 h-4" />}>
          <Textarea className="text-xs min-h-[60px]" defaultValue="09:30-11:30 — Concrete pump breakdown at P-4 footing pour. Replacement arranged from Bhotahiti depot. 2 hours lost. Sub-contractor M/S Lama Constructions notified." />
        </Card>

        {/* Manpower */}
        <Card title="Manpower Log" icon={<Users className="w-4 h-4" />} action={<Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1"><Copy className="w-3 h-3" />Yesterday</Button>}>
          <div className="space-y-1.5">
            {[
              { trade: 'Mason (Skilled)', count: 12, hours: 8 },
              { trade: 'Mazdoor (Unskilled)', count: 48, hours: 8 },
              { trade: 'Bar bender', count: 6, hours: 8 },
              { trade: 'Carpenter', count: 4, hours: 8 },
              { trade: 'Operator', count: 5, hours: 8 },
              { trade: 'Helper', count: 8, hours: 6 },
            ].map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs">
                <Input className="col-span-6 h-7" defaultValue={m.trade} />
                <Input className="col-span-3 h-7 text-right" defaultValue={m.count} />
                <Input className="col-span-3 h-7 text-right" defaultValue={m.hours} />
              </div>
            ))}
          </div>
        </Card>

        {/* Equipment */}
        <Card title="Equipment Log" icon={<Truck className="w-4 h-4" />}>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              <div className="col-span-4">Equipment</div>
              <div className="col-span-2 text-center">Start</div>
              <div className="col-span-2 text-center">End</div>
              <div className="col-span-2 text-center">Output</div>
              <div className="col-span-2 text-center">Fuel</div>
            </div>
            {[
              { name: 'JCB 3DX (Excavator)', start: '08:00', end: '17:00', output: '240 cum', fuel: '32 l', burn: 4.0, norm: 3.5 },
              { name: 'Concrete Mixer 0.4 cum', start: '09:00', end: '15:00', output: '28.5 cum', fuel: '12 l', burn: 2.0, norm: 2.0 },
              { name: 'Tata 1109 (Tipper)', start: '08:30', end: '17:30', output: '14 trips', fuel: '18 l', burn: 2.0, norm: 2.5 },
            ].map((e, i) => {
              const burnAlert = e.burn > e.norm
              return (
                <div key={i} className={cn('grid grid-cols-12 gap-2 items-center text-xs p-1.5 rounded border', burnAlert ? 'border-red-500/40 bg-red-500/5' : 'border-[var(--pane-divider)]')}>
                  <div className="col-span-4">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Fuel className={cn('w-2.5 h-2.5', burnAlert ? 'text-red-500' : 'text-emerald-500')} />
                      Burn {e.burn} l/hr {burnAlert && <span className="text-red-500">· ⚠ above norm {e.norm}</span>}
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-mono">{e.start}</div>
                  <div className="col-span-2 text-center font-mono">{e.end}</div>
                  <div className="col-span-2 text-center font-mono">{e.output}</div>
                  <div className="col-span-2 text-center font-mono">{e.fuel}</div>
                </div>
              )
            })}
            {/* Fuel alert summary */}
            {[
              { name: 'JCB 3DX (Excavator)', burn: 4.0, norm: 3.5 },
            ].filter(e => e.burn > e.norm).length > 0 && (
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-red-600">Fuel burn-rate alert — possible theft or excessive idling</div>
                  <div className="text-muted-foreground mt-0.5">JCB 3DX burned 4.0 l/hr vs RA norm of 3.5 l/hr (14% over). Alert sent to PM and storekeeper. Recommend operator log review and fuel dipstick check.</div>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => toast.error('Alert escalated', { description: 'Fuel anomaly reported to PM and Security.' })}>
                  Escalate
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Geological face log (tunneling) */}
        <Card title="Geological Face Log · Tunneling" icon={<Mountain className="w-4 h-4" />}>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              <div className="col-span-3">Chainage</div>
              <div className="col-span-3">Rock Class</div>
              <div className="col-span-4">Support Installed</div>
              <div className="col-span-2">Advance</div>
            </div>
            {[
              { ch: '0+875', rock: 'Class III (Good)', support: 'Steel ribs @ 1.2m + Shotcrete 50mm', adv: '1.5m' },
              { ch: '0+876.5', rock: 'Class III (Good)', support: 'Steel ribs @ 1.2m + Shotcrete 50mm', adv: '1.5m' },
              { ch: '0+878', rock: 'Class IV (Fair) — deviation', support: 'Steel ribs @ 0.8m + Shotcrete 75mm + Rock bolt', adv: '1.2m', alert: true },
            ].map((g, i) => (
              <div key={i} className={cn('grid grid-cols-12 gap-2 items-center text-xs p-1.5 rounded border', g.alert ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--pane-divider)]')}>
                <div className="col-span-3 font-mono">{g.ch}</div>
                <div className="col-span-3">{g.rock}</div>
                <div className="col-span-4 text-[11px]">{g.support}</div>
                <div className="col-span-2 font-mono text-right">{g.adv}</div>
              </div>
            ))}
            {[
              { ch: '0+878', rock: 'Class IV (Fair) — deviation', support: 'Steel ribs @ 0.8m + Shotcrete 75mm + Rock bolt', adv: '1.2m', alert: true },
            ].some(g => g.alert) && (
              <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">Deviation from design support pattern</div>
                  <div className="text-muted-foreground">Class IV rock encountered at ch. 0+878 — support upgraded. Auto-RFI generated for consultant approval.</div>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"><Mail className="w-3 h-3" />Open RFI</Button>
              </div>
            )}
          </div>
        </Card>
      </PaneBody>
    </>
  )
}

function Card({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--pane-divider)] pane overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--pane-divider)] bg-secondary/20">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <div className="flex-1" />
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function WeatherCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-secondary/40">
      <div className="flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}
