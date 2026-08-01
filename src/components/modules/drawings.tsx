'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  FileText,
  FileStack,
  Upload,
  Link2,
  History,
  Download,
  Eye,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { exportToCsv } from '@/lib/csv-export'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

interface Dwg {
  id: string
  number: string
  title: string
  revision: string
  date: string
  status: 'Approved for Construction' | 'Pending' | 'Superseded' | 'Rejected'
  size: string
  discipline: string
  links: { type: string; ref: string }[]
  history: { rev: string; date: string; note: string }[]
}

const DWS: Dwg[] = [
  {
    id: 'DWG-001',
    number: 'KRR-P3-BR-DR-001',
    title: 'Bridge General Arrangement — Plan & Elevation',
    revision: 'C',
    date: '15 Jul 2026',
    status: 'Approved for Construction',
    size: 'A1',
    discipline: 'Bridge',
    links: [
      { type: 'BOQ', ref: '1.1, 1.2' },
      { type: 'Schedule', ref: 'T-200 series' },
      { type: 'RFI', ref: 'RFI-067' },
      { type: 'DSR', ref: 'D-087' },
    ],
    history: [
      { rev: 'A', date: '02 Jun 2026', note: 'Initial issue for review' },
      { rev: 'B', date: '20 Jun 2026', note: 'Updated pier dimensions per consultant comment' },
      { rev: 'C', date: '15 Jul 2026', note: 'Approved for Construction — AFC stamp' },
    ],
  },
  {
    id: 'DWG-002',
    number: 'KRR-P3-RD-DR-014',
    title: 'Pavement Cross-section — DBM+BC',
    revision: 'B',
    date: '10 Jul 2026',
    status: 'Approved for Construction',
    size: 'A2',
    discipline: 'Roads',
    links: [
      { type: 'BOQ', ref: '2.2' },
      { type: 'Schedule', ref: 'T-400 series' },
    ],
    history: [
      { rev: 'A', date: '25 Jun 2026', note: 'Initial issue' },
      { rev: 'B', date: '10 Jul 2026', note: 'Updated DBM thickness 50mm → 60mm' },
    ],
  },
  {
    id: 'DWG-003',
    number: 'KRR-P3-DR-DR-008',
    title: 'Box Culvert 2×2m — Reinforcement Details',
    revision: 'A',
    date: '18 Jul 2026',
    status: 'Pending',
    size: 'A1',
    discipline: 'Drainage',
    links: [
      { type: 'BOQ', ref: '3.2' },
      { type: 'Schedule', ref: 'T-300 series' },
      { type: 'RFI', ref: 'RFI-067' },
    ],
    history: [
      { rev: 'A', date: '18 Jul 2026', note: 'Initial issue — awaiting consultant review' },
    ],
  },
  {
    id: 'DWG-004',
    number: 'KRR-P3-BR-DR-005',
    title: 'Pier P-4 — Rebar Detailing',
    revision: 'A',
    date: '22 Jul 2026',
    status: 'Pending',
    size: 'A2',
    discipline: 'Bridge',
    links: [
      { type: 'BOQ', ref: '1.2.1' },
      { type: 'NCR', ref: 'NCR-034' },
    ],
    history: [{ rev: 'A', date: '22 Jul 2026', note: 'Initial issue' }],
  },
]

// Derive disciplines from the actual data so empty categories don't show.
const DISCIPLINES = ['All', ...Array.from(new Set(DWS.map((d) => d.discipline)))]

export function DrawingsModule() {
  const [selectedId, setSelectedId] = useState('DWG-001')
  const [discipline, setDiscipline] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const selected = DWS.find((d) => d.id === selectedId) ?? DWS[0]

  const filtered = DWS.filter((d) => {
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
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'drawings-register'
  )

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Disciplines">
            <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <div className="border-b border-[var(--pane-divider)] px-3 py-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Filter drawings…"
                className="h-8 pl-7 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <PaneBody className="py-2">
            {DISCIPLINES.map((d) => {
              const count = d === 'All' ? DWS.length : DWS.filter((x) => x.discipline === d).length
              return (
                <button
                  key={d}
                  onClick={() => setDiscipline(d)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                    discipline === d
                      ? 'bg-accent border-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FileStack className="text-muted-foreground h-3 w-3" />
                    {d}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {count}
                  </Badge>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={`Drawings Register · ${filtered.length} of ${DWS.length}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled
              title="Coming soon"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                exportToCsv(
                  'omnisite-drawings.csv',
                  ['Number', 'Title', 'Discipline', 'Revision', 'Date', 'Size', 'Status'],
                  filtered.map((d) => [
                    d.number,
                    d.title,
                    d.discipline,
                    d.revision,
                    d.date,
                    d.size,
                    d.status,
                  ])
                )
                toast.success('Drawings exported', {
                  description: `${filtered.length} drawings exported to CSV`,
                })
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </PaneHeader>
          <StickyTableShell minWidth={680}>
            <StickyTableHeader>
              {isVisible('number') && <div className="w-32 px-2">Number</div>}
              {isVisible('title') && <div className="flex-1 px-2">Title</div>}
              {isVisible('discipline') && <div className="w-16 px-2">Discipline</div>}
              {isVisible('rev') && <div className="w-20 px-2">Rev</div>}
              {isVisible('size') && <div className="w-12 px-2">Size</div>}
              {isVisible('status') && <div className="w-24 px-2">Status</div>}
              <div className="flex-shrink-0 pr-2">
                <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
              </div>
            </StickyTableHeader>
            <StickyTableBody>
              {filtered.length === 0 ? (
                <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
                  No drawings match this filter.
                </div>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'hover:bg-accent/50 flex h-10 w-full items-center border-b border-[var(--pane-divider)] text-left text-xs transition-colors',
                      selectedId === d.id && 'bg-accent border-l-primary border-l-2'
                    )}
                  >
                    {isVisible('number') && (
                      <div className="text-muted-foreground w-32 px-2 font-mono">{d.number}</div>
                    )}
                    {isVisible('title') && (
                      <div className="flex-1 truncate px-2 font-medium">{d.title}</div>
                    )}
                    {isVisible('discipline') && (
                      <div className="text-muted-foreground w-16 px-2">{d.discipline}</div>
                    )}
                    {isVisible('rev') && <div className="w-20 px-2 font-mono">{d.revision}</div>}
                    {isVisible('size') && <div className="w-12 px-2">{d.size}</div>}
                    {isVisible('status') && (
                      <div className="w-24 px-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px]',
                            d.status === 'Approved for Construction' &&
                              'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                            d.status === 'Pending' &&
                              'border-amber-500/40 text-amber-700 dark:text-amber-300'
                          )}
                        >
                          {d.status === 'Approved for Construction' ? 'AFC' : d.status}
                        </Badge>
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
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {dwg.discipline}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                dwg.status === 'Approved for Construction' &&
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                dwg.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              )}
            >
              Rev {dwg.revision} · {dwg.status}
            </Badge>
          </div>
          <div className="text-sm leading-snug font-semibold">{dwg.title}</div>
          <div className="text-muted-foreground mt-1 font-mono text-xs">
            {dwg.number} · {dwg.size} · {dwg.date}
          </div>
        </div>

        {/* PDF Viewer with page navigation + zoom */}
        <div className="m-4">
          {/* Viewer area */}
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-md border border-[var(--pane-divider)] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"
            style={{ height: `${300 * zoom}px` }}
          >
            <div className="grid-bg absolute inset-0 opacity-30" />
            {/* Simulated page content — scales with zoom */}
            <div
              className="relative z-10 transition-transform"
              style={{ transform: `scale(${zoom})` }}
            >
              <div
                className="rounded-sm bg-white p-6 shadow-lg dark:bg-slate-100"
                style={{ width: '210px', height: '148px' }}
              >
                <div className="mb-1 text-[6px] tracking-wider text-slate-400 uppercase">
                  {dwg.number} · Rev {dwg.revision}
                </div>
                <div className="mb-1 text-[8px] font-bold text-slate-900">{dwg.title}</div>
                <div className="my-1 border-t border-slate-300" />
                {/* Simulated drawing content */}
                <svg viewBox="0 0 180 90" className="h-20 w-full">
                  <rect
                    x="10"
                    y="10"
                    width="160"
                    height="70"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="10"
                    y1="45"
                    x2="170"
                    y2="45"
                    stroke="#475569"
                    strokeWidth="0.3"
                    strokeDasharray="2 1"
                  />
                  <rect
                    x="30"
                    y="20"
                    width="40"
                    height="25"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="0.5"
                  />
                  <rect
                    x="80"
                    y="20"
                    width="40"
                    height="25"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="0.5"
                  />
                  <circle cx="100" cy="60" r="8" fill="none" stroke="#475569" strokeWidth="0.5" />
                  <text x="50" y="35" fontSize="4" fill="#475569">
                    SECTION A-A
                  </text>
                  <text x="90" y="35" fontSize="4" fill="#475569">
                    DETAIL 1
                  </text>
                  <text x="92" y="63" fontSize="3" fill="#475569">
                    Ø 600
                  </text>
                  <line x1="10" y1="80" x2="170" y2="80" stroke="#475569" strokeWidth="0.3" />
                  <text x="10" y="88" fontSize="3" fill="#94a3b8">
                    SCALE 1:50
                  </text>
                  <text x="130" y="88" fontSize="3" fill="#94a3b8">
                    SHEET {page}/{totalPages}
                  </text>
                </svg>
              </div>
            </div>

            {/* Top-right controls */}
            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 w-7 p-0"
                title="Fullscreen (coming soon)"
                disabled
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Markup toolbar */}
            <div className="pane absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-md border border-[var(--pane-divider)] p-1 shadow-md">
              {['✎', '▢', '◯', '↔', 'T'].map((t, i) => (
                <button
                  key={i}
                  className="hover:bg-accent flex h-7 w-7 items-center justify-center rounded text-sm"
                  title={`Markup: ${t} (coming soon)`}
                  disabled
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Page navigation + zoom controls */}
          <div className="mt-2 flex items-center justify-between px-1">
            {/* Page nav */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-1 font-mono text-xs tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center font-mono text-[10px] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                disabled={zoom >= 2}
              >
                <ZoomIn className="h-3.5 w-3.5" />
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

        <div className="space-y-3 px-4 pb-4">
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Link2 className="h-3 w-3" />
              Bi-Directional Links
            </div>
            <div className="space-y-1.5">
              {dwg.links.map((l, i) => (
                <div
                  key={i}
                  className="hover:bg-accent/30 flex cursor-not-allowed cursor-pointer items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5 text-xs opacity-40"
                  title="Coming soon"
                  aria-disabled="true"
                >
                  <Badge variant="outline" className="text-[9px]">
                    {l.type}
                  </Badge>
                  <span className="flex-1 truncate">{l.ref}</span>
                  <Eye className="text-muted-foreground h-3 w-3" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <History className="h-3 w-3" />
              Revision History
            </div>
            <div className="space-y-1.5">
              {dwg.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="flex gap-2.5 text-xs">
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        i === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      {h.rev}
                    </div>
                    <div className="-ml-3.5 flex-1 border-l-2 border-[var(--pane-divider)] pb-2 pl-3">
                      <div className="font-medium">Revision {h.rev}</div>
                      <div className="text-muted-foreground text-[10px]">{h.date}</div>
                      <div className="mt-0.5 text-[11px]">{h.note}</div>
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
