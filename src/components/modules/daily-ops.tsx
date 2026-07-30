'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Search, Plus, ChevronRight, Cloud, Users, Truck, Mail, Copy, Camera,
  AlertTriangle, CheckCircle2, Clock, MapPin, Fuel, Gauge, FileText,
  Mountain, TrendingUp, Thermometer, Droplets, Wind, Calendar, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface DsrEntry {
  id: string
  task: string
  source: 'Sched' | 'Backlog' | 'RFI' | 'Manual'
  chainage: string
  planned: number
  actual: number
  uom: string
  status: 'in-progress' | 'completed' | 'blocked' | 'pending'
  hasRfi?: boolean
  hasPhotos?: boolean
  remarks?: string
}

const DSR_ENTRIES: DsrEntry[] = [
  { id: 'D-087', task: 'PCC M15 pouring', source: 'Sched', chainage: '4+200 — 4+350', planned: 30, actual: 28.5, uom: 'cum', status: 'in-progress', hasPhotos: true, remarks: 'Concrete pump breakdown 2 hrs, recovered' },
  { id: 'D-088', task: 'Rebar fixing — footing', source: 'Sched', chainage: '4+350 — 4+500', planned: 1.8, actual: 1.5, uom: 'MT', status: 'in-progress', hasPhotos: true },
  { id: 'D-089', task: 'Excavation', source: 'Backlog', chainage: '5+000 — 5+150', planned: 220, actual: 240, uom: 'cum', status: 'completed', hasPhotos: true, remarks: 'Hard rock encountered, used breaker' },
  { id: 'D-090', task: 'Shuttering — column', source: 'Manual', chainage: 'Pier P-4', planned: 12, actual: 12, uom: 'sqm', status: 'completed', hasPhotos: true },
  { id: 'D-091', task: 'Dewatering', source: 'Manual', chainage: '4+200', planned: 0, actual: 6, uom: 'hr', status: 'in-progress', remarks: 'Water table higher than expected' },
  { id: 'D-092', task: 'Hammock — tunnel support', source: 'RFI', chainage: 'Ch 0+875', planned: 0, actual: 4.5, uom: 'm', status: 'in-progress', hasRfi: true, hasPhotos: true, remarks: 'Rock class III encountered, installed steel ribs' },
]

export function DailyOpsModule() {
  const [view, setView] = useState<'progress' | 'log'>('progress')
  const [selectedId, setSelectedId] = useState('D-087')
  const selected = DSR_ENTRIES.find(d => d.id === selectedId) ?? DSR_ENTRIES[0]

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Site Execution">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)] space-y-2">
            <div className="flex gap-1">
              <Button
                variant={view === 'progress' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => setView('progress')}
              >Work Progress</Button>
              <Button
                variant={view === 'log' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => setView('log')}
              >Daily Site Log</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter by task / chainage…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Today · 30 Jul
            </div>
            <div className="text-[10px] text-muted-foreground px-3 mb-2">Auto-generated from Schedule + Backlog · 6 entries</div>
            {DSR_ENTRIES.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'w-full text-left px-3 py-2 border-l-2 hover:bg-accent/50 transition-colors',
                  selectedId === d.id ? 'bg-accent border-l-primary' : 'border-l-transparent'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{d.id}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">{d.source}</Badge>
                  {d.hasRfi && <Mail className="w-3 h-3 text-sky-500" />}
                  {d.hasPhotos && <Camera className="w-3 h-3 text-violet-500" />}
                  <span className="ml-auto">
                    <StatusDot status={d.status} />
                  </span>
                </div>
                <div className="text-xs font-medium mt-0.5 truncate">{d.task}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>{d.chainage}</span>
                </div>
              </button>
            ))}
          </PaneBody>
        </>
      }
      centerPane={
        view === 'progress' ? (
          <WorkProgressView entries={DSR_ENTRIES} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <DailySiteLogView />
        )
      }
      rightPane={<DsrInspector entry={selected} />}
      leftPaneWidth="280px"
      rightPaneWidth="380px"
    />
  )
}

function StatusDot({ status }: { status: DsrEntry['status'] }) {
  const map = {
    'in-progress': { color: 'bg-amber-500', label: 'In progress' },
    'completed': { color: 'bg-emerald-500', label: 'Completed' },
    'blocked': { color: 'bg-red-500', label: 'Blocked' },
    'pending': { color: 'bg-slate-400', label: 'Pending' },
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className={cn('w-1.5 h-1.5 rounded-full', map[status].color)} />
      {map[status].label}
    </span>
  )
}

function WorkProgressView({ entries, selectedId, onSelect }: {
  entries: DsrEntry[]; selectedId: string; onSelect: (id: string) => void
}) {
  const selected = entries.find(e => e.id === selectedId)
  return (
    <>
      <PaneHeader title="Work Progress · Auto-generated from Schedule">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Ad-Hoc Entry</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Copy className="w-3.5 h-3.5" />Copy Yesterday</Button>
      </PaneHeader>

      {/* ITR auto-prompt when selected entry is completed */}
      {selected?.status === 'completed' && (
        <div className="px-4 py-2 border-b border-[var(--pane-divider)] bg-emerald-500/10 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">ITR auto-prompted:</span>
            <span className="text-muted-foreground"> {selected.id} marked completed → Inspection Test Request ITR-{Math.floor(Math.random() * 9000) + 1000} auto-generated for consultant approval.</span>
          </span>
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => toast.success('Opening ITR', { description: 'Redirecting to Q&S module' })}>
            View ITR
          </Button>
        </div>
      )}
      <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
        <div className="w-20 px-2">DSR #</div>
        <div className="flex-1 px-2">Task</div>
        <div className="w-32 px-2">Chainage</div>
        <div className="w-20 px-2 text-right">Planned</div>
        <div className="w-20 px-2 text-right">Actual</div>
        <div className="w-14 px-2">UOM</div>
        <div className="w-28 px-2">Status</div>
        <div className="w-12 px-2 text-center">Actions</div>
      </div>
      <PaneBody className="px-0">
        {entries.map(d => {
          const variance = d.actual - d.planned
          const variancePct = d.planned > 0 ? (variance / d.planned) * 100 : 0
          return (
            <div
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={cn(
                'flex items-center h-10 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover transition-colors',
                selectedId === d.id && 'bg-accent'
              )}
            >
              <div className="w-20 px-2 font-mono text-muted-foreground">{d.id}</div>
              <div className="flex-1 px-2 min-w-0">
                <div className="font-medium truncate">{d.task}</div>
                {d.remarks && <div className="text-[10px] text-muted-foreground truncate">{d.remarks}</div>}
              </div>
              <div className="w-32 px-2 font-mono text-[10px] text-muted-foreground truncate">{d.chainage}</div>
              <div className="w-20 px-2 text-right font-mono">{d.planned || '—'}</div>
              <div className={cn('w-20 px-2 text-right font-mono', variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : '')}>
                {d.actual || '—'}
                {d.planned > 0 && (
                  <span className="text-[9px] text-muted-foreground ml-0.5">({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)</span>
                )}
              </div>
              <div className="w-14 px-2 text-muted-foreground">{d.uom}</div>
              <div className="w-28 px-2"><StatusDot status={d.status} /></div>
              <div className="w-12 px-2 flex items-center gap-1 justify-center">
                {d.hasRfi && <Mail className="w-3 h-3 text-sky-500" />}
                {d.hasPhotos && <Camera className="w-3 h-3 text-violet-500" />}
                {!d.hasRfi && !d.hasPhotos && <span className="text-muted-foreground/30">—</span>}
              </div>
            </div>
          )
        })}
      </PaneBody>
    </>
  )
}

function DailySiteLogView() {
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

function DsrInspector({ entry }: { entry: DsrEntry }) {
  const theoretical = entry.actual * 4.5 // bags per cum (cement)
  const issued = 132
  const variance = ((issued - theoretical) / theoretical) * 100
  const overVariance = Math.abs(variance) > 5
  // RFI draft modal state
  const [rfiModalOpen, setRfiModalOpen] = useState(false)
  const [rfiDraft, setRfiDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  const [rfiSaved, setRfiSaved] = useState(false)

  const generateRfi = () => {
    // Auto-populate background from DSR remarks + entry details
    const autoBackground = `DSR Entry ${entry.id} — ${entry.task} at ${entry.chainage}.\nPlanned: ${entry.planned} ${entry.uom}, Actual: ${entry.actual} ${entry.uom}.\nRemarks: ${entry.remarks || 'No remarks recorded.'}\nSource: ${entry.source}.`
    setRfiDraft({
      subject: `RFI re: ${entry.task} — ${entry.chainage}`,
      question: '', // mandatory — left blank to highlight
      impact: '',   // mandatory — left blank to highlight
      background: autoBackground,
    })
    setRfiSaved(false)
    setRfiModalOpen(true)
  }

  const saveRfi = () => {
    if (!rfiDraft.question.trim() || !rfiDraft.impact.trim()) {
      return // validation handled in UI
    }
    setRfiSaved(true)
    setTimeout(() => setRfiModalOpen(false), 1200)
  }

  return (
    <>
      <PaneHeader title={`DSR Inspector · ${entry.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">Source: {entry.source}</Badge>
            <Badge variant="secondary" className="text-[10px]">{entry.status}</Badge>
          </div>
          <div className="text-sm font-semibold leading-snug">{entry.task}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {entry.chainage}
          </div>
        </div>

        <Tabs defaultValue="progress">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 w-full text-xs">
              <TabsTrigger value="progress" className="text-[11px]">Progress</TabsTrigger>
              <TabsTrigger value="material" className="text-[11px]">Material Reconciliation</TabsTrigger>
              <TabsTrigger value="photos" className="text-[11px]">Photos/Docs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="progress" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Planned Qty</label>
              <Input className="mt-1 h-8" defaultValue={entry.planned} />
              <span className="text-[10px] text-muted-foreground">{entry.uom}</span>
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Actual Completed Qty</label>
              <Input className="mt-1 h-8" defaultValue={entry.actual} />
              <span className="text-[10px] text-muted-foreground">{entry.uom}</span>
            </div>
            <div className="p-2.5 rounded-md bg-secondary/40">
              <div className="flex justify-between"><span className="text-muted-foreground">Variance</span><span className="font-mono font-medium">{(entry.actual - entry.planned).toFixed(1)} {entry.uom}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cumulative for task</span><span className="font-mono">87 / 145 cum (60%)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Task % done (locked)</span><span className="font-mono font-semibold">60%</span></div>
            </div>
            <Separator />
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Remarks</label>
              <Textarea className="mt-1 text-xs min-h-[60px]" defaultValue={entry.remarks} />
            </div>

            <div className="p-2.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-sky-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">Generate RFI from this DSR entry</div>
                <div className="text-muted-foreground">Auto-populates Background from remarks + photos. Missing mandatory fields will be highlighted.</div>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={generateRfi}>❓ Generate RFI</Button>
            </div>
          </TabsContent>

          <TabsContent value="material" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theoretical vs Issued</div>
            <div className="space-y-2">
              <MaterialRow mat="Cement OPC 53 (Bag)" theoretical={theoretical} issued={issued} uom="bag" />
              <MaterialRow mat="River Sand (cum)" theoretical={entry.actual * 0.45} issued={12.8} uom="cum" />
              <MaterialRow mat="Coarse Agg. 20mm (cum)" theoretical={entry.actual * 0.9} issued={25.4} uom="cum" />
            </div>
            {overVariance && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                <div>
                  <div className="font-medium">Material variance &gt; 5% — cannot mark Completed</div>
                  <div className="text-muted-foreground">Cement consumption {variance.toFixed(1)}% above theoretical. Mandatory remark required to override.</div>
                  <Button size="sm" variant="outline" className="h-6 mt-1.5 text-[10px]">Add override remark</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-0 px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square rounded-md bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white/60" />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs gap-1.5"><Camera className="w-3.5 h-3.5" />Upload Photo</Button>
          </TabsContent>
        </Tabs>
      </PaneBody>

      {/* RFI Draft Modal */}
      {rfiModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRfiModalOpen(false)}
        >
          <div
            className="w-full max-w-lg pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-sky-500/10">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-semibold">
                  {rfiSaved ? 'RFI Draft Saved' : 'New RFI Draft — Auto-populated from DSR'}
                </span>
              </div>
              <button onClick={() => setRfiModalOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {rfiSaved ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <div className="text-sm font-semibold">RFI-{Math.floor(Math.random() * 9000) + 1000} created</div>
                <div className="text-xs text-muted-foreground mt-1">Draft saved to Correspondence module. Consultant notified.</div>
              </div>
            ) : (
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {/* RFI number + linked DSR */}
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">RFI-DRAFT</Badge>
                  <span className="text-muted-foreground">Linked to: <span className="font-mono text-foreground">{entry.id}</span></span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{entry.chainage}</span>
                </div>

                {/* Subject — auto-populated */}
                <div>
                  <label className="text-xs font-medium">Subject</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={rfiDraft.subject}
                    onChange={(e) => setRfiDraft(d => ({ ...d, subject: e.target.value }))}
                  />
                </div>

                {/* Background — auto-populated from DSR */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    Background
                    <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-normal">auto-filled from DSR</span>
                  </label>
                  <Textarea
                    className="mt-1 text-xs min-h-[80px] font-mono"
                    value={rfiDraft.background}
                    onChange={(e) => setRfiDraft(d => ({ ...d, background: e.target.value }))}
                  />
                </div>

                {/* Question — MANDATORY, highlighted if empty */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Question <span className="text-red-500">*</span>
                    {!rfiDraft.question.trim() && (
                      <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn('mt-1 text-xs min-h-[60px]', !rfiDraft.question.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20')}
                    placeholder="State the specific question for the consultant..."
                    value={rfiDraft.question}
                    onChange={(e) => setRfiDraft(d => ({ ...d, question: e.target.value }))}
                    autoFocus
                  />
                </div>

                {/* Impact — MANDATORY, highlighted if empty */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Impact <span className="text-red-500">*</span>
                    {!rfiDraft.impact.trim() && (
                      <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn('mt-1 text-xs min-h-[60px]', !rfiDraft.impact.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20')}
                    placeholder="Describe cost/schedule impact if not resolved..."
                    value={rfiDraft.impact}
                    onChange={(e) => setRfiDraft(d => ({ ...d, impact: e.target.value }))}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--pane-divider)]">
                  <div className="text-[10px] text-muted-foreground">
                    {(!rfiDraft.question.trim() || !rfiDraft.impact.trim())
                      ? <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fill mandatory fields to save</span>
                      : <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready to save</span>
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRfiModalOpen(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!rfiDraft.question.trim() || !rfiDraft.impact.trim()}
                      onClick={saveRfi}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Save RFI Draft
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MaterialRow({ mat, theoretical, issued, uom }: { mat: string; theoretical: number; issued: number; uom: string }) {
  const variance = ((issued - theoretical) / theoretical) * 100
  const over = Math.abs(variance) > 5
  return (
    <div className={cn('p-2 rounded border', over ? 'border-red-500/40 bg-red-500/5' : 'border-[var(--pane-divider)]')}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{mat}</span>
        {over ? <AlertTriangle className="w-3 h-3 text-red-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Theoretical</div>
          <div className="font-mono font-medium">{theoretical.toFixed(2)} {uom}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Issued (MIN)</div>
          <div className="font-mono font-medium">{issued.toFixed(2)} {uom}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Variance</div>
          <div className={cn('font-mono font-medium', over && 'text-red-500')}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}
