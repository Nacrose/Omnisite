'use client'

import { useState, useRef } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, FileStack, Upload, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { exportToCsv } from '@/lib/csv-export'
import { uploadFile, STORAGE_BUCKETS } from '@/lib/storage'
import { useApp } from '@/lib/app-store'
import { DrawingsRegister } from './register'
import { DrawingInspector } from './inspector'

export interface Dwg {
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
  const { activeProjectDbId } = useApp()
  const [selectedId, setSelectedId] = useState('DWG-001')
  const [discipline, setDiscipline] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selected = DWS.find((d) => d.id === selectedId) ?? DWS[0]

  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
  const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
  const ACCEPTED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Always reset the input value so the same file can be picked again later.
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

    setUploading(true)
    try {
      const result = await uploadFile(
        STORAGE_BUCKETS.DRAWINGS,
        file,
        activeProjectDbId ?? 'unscoped'
      )
      if (result.error) {
        toast.error('Upload failed', { description: result.error })
      } else {
        toast.success('Drawing uploaded', {
          description: `${file.name} stored in the drawings bucket.`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Upload failed', { description: msg })
    } finally {
      setUploading(false)
    }
  }

  const filtered = DWS.filter((d) => {
    if (discipline !== 'All' && d.discipline !== discipline) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return d.number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q)
    }
    return true
  })

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
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Upload a drawing (PDF, PNG, JPEG, WebP — max 25 MB)"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : 'Upload'}
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
          <DrawingsRegister
            drawings={filtered}
            selectedId={selectedId}
            onSelectId={setSelectedId}
          />
        </>
      }
      rightPane={<DrawingInspector key={selected.id} dwg={selected} />}
      leftPaneWidth="220px"
      rightPaneWidth="380px"
    />
  )
}
