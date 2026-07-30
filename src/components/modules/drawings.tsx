'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, FileText, FileStack, Upload, Link2, History, Download, Eye, Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Dwg {
  id: string; number: string; title: string; revision: string; date: string; status: 'Approved for Construction' | 'Pending' | 'Superseded' | 'Rejected'
  size: string; discipline: string; links: { type: string; ref: string }[]
  history: { rev: string; date: string; note: string }[]
}

const DWS: Dwg[] = [
  {
    id: 'DWG-001', number: 'KRR-P3-BR-DR-001', title: 'Bridge General Arrangement — Plan & Elevation', revision: 'C', date: '15 Jul 2026', status: 'Approved for Construction', size: 'A1', discipline: 'Bridge',
    links: [{ type: 'BOQ', ref: '1.1, 1.2' }, { type: 'Schedule', ref: 'T-200 series' }, { type: 'RFI', ref: 'RFI-067' }, { type: 'DSR', ref: 'D-087' }],
    history: [
      { rev: 'A', date: '02 Jun 2026', note: 'Initial issue for review' },
      { rev: 'B', date: '20 Jun 2026', note: 'Updated pier dimensions per consultant comment' },
      { rev: 'C', date: '15 Jul 2026', note: 'Approved for Construction — AFC stamp' },
    ],
  },
  {
    id: 'DWG-002', number: 'KRR-P3-RD-DR-014', title: 'Pavement Cross-section — DBM+BC', revision: 'B', date: '10 Jul 2026', status: 'Approved for Construction', size: 'A2', discipline: 'Roads',
    links: [{ type: 'BOQ', ref: '2.2' }, { type: 'Schedule', ref: 'T-400 series' }],
    history: [
      { rev: 'A', date: '25 Jun 2026', note: 'Initial issue' },
      { rev: 'B', date: '10 Jul 2026', note: 'Updated DBM thickness 50mm → 60mm' },
    ],
  },
  {
    id: 'DWG-003', number: 'KRR-P3-DR-DR-008', title: 'Box Culvert 2×2m — Reinforcement Details', revision: 'A', date: '18 Jul 2026', status: 'Pending', size: 'A1', discipline: 'Drainage',
    links: [{ type: 'BOQ', ref: '3.2' }, { type: 'Schedule', ref: 'T-300 series' }, { type: 'RFI', ref: 'RFI-067' }],
    history: [{ rev: 'A', date: '18 Jul 2026', note: 'Initial issue — awaiting consultant review' }],
  },
  {
    id: 'DWG-004', number: 'KRR-P3-BR-DR-005', title: 'Pier P-4 — Rebar Detailing', revision: 'A', date: '22 Jul 2026', status: 'Pending', size: 'A2', discipline: 'Bridge',
    links: [{ type: 'BOQ', ref: '1.2.1' }, { type: 'NCR', ref: 'NCR-034' }],
    history: [{ rev: 'A', date: '22 Jul 2026', note: 'Initial issue' }],
  },
]

export function DrawingsModule() {
  const [selectedId, setSelectedId] = useState('DWG-001')
  const selected = DWS.find(d => d.id === selectedId) ?? DWS[0]

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Disciplines">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter drawings…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            {['All', 'Bridge', 'Roads', 'Drainage', 'Structural', 'Electrical', 'Signage'].map(d => {
              const count = d === 'All' ? DWS.length : DWS.filter(x => x.discipline === d).length
              return (
                <button key={d} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/50">
                  <span className="flex items-center gap-2"><FileStack className="w-3 h-3 text-muted-foreground" />{d}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="Drawing Register · ISO 19650">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Download className="w-3.5 h-3.5" />Export</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Upload className="w-3.5 h-3.5" />Upload Drawing</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-40 px-2">Dwg Number</div>
            <div className="flex-1 px-2">Title</div>
            <div className="w-16 px-2">Rev</div>
            <div className="w-24 px-2">Date</div>
            <div className="w-12 px-2 text-center">Size</div>
            <div className="w-44 px-2">Status</div>
            <div className="w-20 px-2 text-center">Links</div>
          </div>
          <PaneBody className="px-0">
            {DWS.map(d => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn('flex items-center h-10 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === d.id && 'bg-accent')}
              >
                <div className="w-40 px-2 font-mono text-[10px] text-muted-foreground truncate">{d.number}</div>
                <div className="flex-1 px-2 font-medium truncate">{d.title}</div>
                <div className="w-16 px-2 font-mono font-semibold">{d.revision}</div>
                <div className="w-24 px-2 text-muted-foreground">{d.date}</div>
                <div className="w-12 px-2 text-center text-muted-foreground">{d.size}</div>
                <div className="w-44 px-2">
                  <Badge variant="secondary" className={cn('text-[10px]', d.status === 'Approved for Construction' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', d.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300', d.status === 'Superseded' && 'bg-slate-400/15', d.status === 'Rejected' && 'bg-red-500/15 text-red-700 dark:text-red-300')}>{d.status}</Badge>
                </div>
                <div className="w-20 px-2 text-center">
                  <Badge variant="outline" className="text-[9px]">{d.links.length} refs</Badge>
                </div>
              </div>
            ))}
          </PaneBody>
        </>
      }
      rightPane={<DrawingInspector dwg={selected} />}
      leftPaneWidth="220px"
      rightPaneWidth="380px"
    />
  )
}

function DrawingInspector({ dwg }: { dwg: Dwg }) {
  return (
    <>
      <PaneHeader title={`PDF Inspector · ${dwg.number}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{dwg.discipline}</Badge>
            <Badge variant="secondary" className={cn('text-[10px]', dwg.status === 'Approved for Construction' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', dwg.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>Rev {dwg.revision} · {dwg.status}</Badge>
          </div>
          <div className="text-sm font-semibold leading-snug">{dwg.title}</div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">{dwg.number} · {dwg.size} · {dwg.date}</div>
        </div>

        {/* PDF Viewer mock */}
        <div className="aspect-[1.414/1] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 m-4 rounded-md flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="text-center relative z-10">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div className="text-xs text-muted-foreground mt-2">PDF Preview · {dwg.number}</div>
            <div className="text-[10px] text-muted-foreground">Revision {dwg.revision}</div>
          </div>
          <div className="absolute top-2 right-2 flex gap-1">
            <Button size="sm" variant="secondary" className="h-7 w-7 p-0"><Maximize2 className="w-3.5 h-3.5" /></Button>
          </div>
          {/* Markup toolbar */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pane border border-[var(--pane-divider)] rounded-md p-1 shadow-md">
            {['✎', '▢', '◯', '↔', 'T'].map(t => (
              <button key={t} className="w-7 h-7 rounded text-sm hover:bg-accent flex items-center justify-center">{t}</button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Link2 className="w-3 h-3" />Bi-Directional Links</div>
            <div className="space-y-1.5">
              {dwg.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)] text-xs hover:bg-accent/30 cursor-pointer">
                  <Badge variant="outline" className="text-[9px]">{l.type}</Badge>
                  <span className="flex-1 truncate">{l.ref}</span>
                  <Eye className="w-3 h-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><History className="w-3 h-3" />Revision History</div>
            <div className="space-y-1.5">
              {dwg.history.slice().reverse().map((h, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0', i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{h.rev}</div>
                  <div className="flex-1 pb-2 border-l-2 border-[var(--pane-divider)] pl-3 -ml-3.5">
                    <div className="font-medium">Revision {h.rev}</div>
                    <div className="text-[10px] text-muted-foreground">{h.date}</div>
                    <div className="text-[11px] mt-0.5">{h.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
