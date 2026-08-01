'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, FileText, FileStack, Upload, Link2, History, Download, Eye, Maximize2,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { exportToCsv } from '@/lib/csv-export'
import {
  useColumnVisibility, ColumnToggle, StickyTableShell, StickyTableHeader, StickyTableBody, type ColumnDef,
} from '@/components/ui/table-utils'

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

// Derive disciplines from the actual data so empty categories don't show.
const DISCIPLINES = ['All', ...Array.from(new Set(DWS.map(d => d.discipline)))]

export function DrawingsModule() {
  const [selectedId, setSelectedId] = useState('DWG-001')
  const [discipline, setDiscipline] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const selected = DWS.find(d => d.id === selectedId) ?? DWS[0]

  const filtered = DWS.filter(d => {
    if (discipline !== 'All' && d.discipline !== discipline) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return d.number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q)
    }
    return true
  })

  const COLS: ColumnDef[] = [
    { key: 'number', label: 'Number' },
    { key: 'title', label: 'Title' },
    { key: 'discipline', label: 'Discipline' },
    { key: 'rev', label: 'Rev' },
    { key: 'size', label: 'Size' },
    { key: 'status', label: 'Status' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(COLS.map(c => c.key), [], 'drawings-register')

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Disciplines">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter drawings…" className="h-8 pl-7 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <PaneBody className="py-2">
            {DISCIPLINES.map(d => {
              const count = d === 'All' ? DWS.length : DWS.filter(x => x.discipline === d).length
              return (
                <button key={d} onClick={() => setDiscipline(d)} className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs', discipline === d ? 'bg-accent border-l-2 border-primary' : 'hover:bg-accent/50 border-l-2 border-transparent')}>
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
          <PaneHeader title={`Drawings Register · ${filtered.length} of ${DWS.length}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Upload className="w-3.5 h-3.5" />Upload</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => {
              exportToCsv('omnisite-drawings.csv', ['Number', 'Title', 'Discipline', 'Revision', 'Date', 'Size', 'Status'],
                filtered.map(d => [d.number, d.title, d.discipline, d.revision, d.date, d.size, d.status]))
              toast.success('Drawings exported', { description: `${filtered.length} drawings exported to CSV` })
            }}><Download className="w-3.5 h-3.5" />Export</Button>
          </PaneHeader>
          <StickyTableShell minWidth={680}>
            <StickyTableHeader>
              {isVisible('number') && <div className="w-32 px-2">Number</div>}
              {isVisible('title') && <div className="flex-1 px-2">Title</div>}
              {isVisible('discipline') && <div className="w-16 px-2">Discipline</div>}
              {isVisible('rev') && <div className="w-20 px-2">Rev</div>}
              {isVisible('size') && <div className="w-12 px-2">Size</div>}
              {isVisible('status') && <div className="w-24 px-2">Status</div>}
              <div className="flex-shrink-0 pr-2"><ColumnToggle columns={COLS} visible={visible} onToggle={toggle} /></div>
            </StickyTableHeader>
            <StickyTableBody>
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">No drawings match this filter.</div>
              ) : (
                filtered.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'w-full flex items-center h-10 border-b border-[var(--pane-divider)] text-xs hover:bg-accent/50 transition-colors text-left',
                      selectedId === d.id && 'bg-accent border-l-2 border-l-primary'
                    )}
                  >
                    {isVisible('number') && <div className="w-32 px-2 font-mono text-muted-foreground">{d.number}</div>}
                    {isVisible('title') && <div className="flex-1 px-2 font-medium truncate">{d.title}</div>}
                    {isVisible('discipline') && <div className="w-16 px-2 text-muted-foreground">{d.discipline}</div>}
                    {isVisible('rev') && <div className="w-20 px-2 font-mono">{d.revision}</div>}
                    {isVisible('size') && <div className="w-12 px-2">{d.size}</div>}
                    {isVisible('status') && (
                      <div className="w-24 px-2">
                        <Badge variant="outline" className={cn('text-[9px]', d.status === 'Approved for Construction' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', d.status === 'Pending' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{d.status === 'Approved for Construction' ? 'AFC' : d.status}</Badge>
                      </div>
                    )}
                  </button>
                ))
              )}
            </StickyTableBody>
          </StickyTableShell>
        </>
      }
      rightPane={<DrawingInspector key={selected.id} dwg={selected} />}
      leftPaneWidth="220px"
      rightPaneWidth="380px"
    />
  )
}

function DrawingInspector({ dwg }: { dwg: Dwg }) {
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const totalPages = dwg.size === 'A1' ? 4 : dwg.size === 'A2' ? 2 : 1

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

        {/* PDF Viewer with page navigation + zoom */}
        <div className="m-4">
          {/* Viewer area */}
          <div
            className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-md flex items-center justify-center relative overflow-hidden border border-[var(--pane-divider)]"
            style={{ height: `${300 * zoom}px` }}
          >
            <div className="absolute inset-0 grid-bg opacity-30" />
            {/* Simulated page content — scales with zoom */}
            <div className="relative z-10 transition-transform" style={{ transform: `scale(${zoom})` }}>
              <div className="bg-white dark:bg-slate-100 shadow-lg rounded-sm p-6" style={{ width: '210px', height: '148px' }}>
                <div className="text-[6px] text-slate-400 uppercase tracking-wider mb-1">{dwg.number} · Rev {dwg.revision}</div>
                <div className="text-[8px] font-bold text-slate-900 mb-1">{dwg.title}</div>
                <div className="border-t border-slate-300 my-1" />
                {/* Simulated drawing content */}
                <svg viewBox="0 0 180 90" className="w-full h-20">
                  <rect x="10" y="10" width="160" height="70" fill="none" stroke="#475569" strokeWidth="0.5" />
                  <line x1="10" y1="45" x2="170" y2="45" stroke="#475569" strokeWidth="0.3" strokeDasharray="2 1" />
                  <rect x="30" y="20" width="40" height="25" fill="none" stroke="#0ea5e9" strokeWidth="0.5" />
                  <rect x="80" y="20" width="40" height="25" fill="none" stroke="#0ea5e9" strokeWidth="0.5" />
                  <circle cx="100" cy="60" r="8" fill="none" stroke="#475569" strokeWidth="0.5" />
                  <text x="50" y="35" fontSize="4" fill="#475569">SECTION A-A</text>
                  <text x="90" y="35" fontSize="4" fill="#475569">DETAIL 1</text>
                  <text x="92" y="63" fontSize="3" fill="#475569">Ø 600</text>
                  <line x1="10" y1="80" x2="170" y2="80" stroke="#475569" strokeWidth="0.3" />
                  <text x="10" y="88" fontSize="3" fill="#94a3b8">SCALE 1:50</text>
                  <text x="130" y="88" fontSize="3" fill="#94a3b8">SHEET {page}/{totalPages}</text>
                </svg>
              </div>
            </div>

            {/* Top-right controls */}
            <div className="absolute top-2 right-2 flex gap-1">
              <Button size="sm" variant="secondary" className="h-7 w-7 p-0" title="Fullscreen" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Maximize2 className="w-3.5 h-3.5" /></Button>
            </div>

            {/* Markup toolbar */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pane border border-[var(--pane-divider)] rounded-md p-1 shadow-md">
              {['✎', '▢', '◯', '↔', 'T'].map((t, i) => (
                <button key={i} className="w-7 h-7 rounded text-sm hover:bg-accent flex items-center justify-center" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })} title={`Markup: ${t}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Page navigation + zoom controls */}
          <div className="flex items-center justify-between mt-2 px-1">
            {/* Page nav */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono tabular-nums px-1">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[10px] font-mono tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                disabled={zoom >= 2}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px]"
                onClick={() => setZoom(1)}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Link2 className="w-3 h-3" />Bi-Directional Links</div>
            <div className="space-y-1.5">
              {dwg.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)] text-xs hover:bg-accent/30 cursor-pointer" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}>
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
