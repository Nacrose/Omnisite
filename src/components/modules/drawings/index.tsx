'use client'

import { useState, useRef, useMemo } from 'react'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
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
import {
  type Dwg,
  type DrawingFileType,
  DRAWING_ACCEPT_ATTR,
  DRAWING_ALLOWED_EXTS,
  detectDrawingFileType,
  formatFileSize,
} from './types'

// Re-export the Dwg type so existing callers (`./register`, `./inspector`)
// that imported from `./index` keep compiling. The canonical home is now
// `./types`.
export type { Dwg } from './types'

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
    fileType: 'pdf',
    // No fileUrl attached on the seed drawing — the viewer will fall back
    // to a placeholder PDF so the markup UX is still demonstrable.
    fileUrl: undefined,
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
    fileType: 'pdf',
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
    fileType: 'dwg',
    sourceFileUrl: undefined,
    fileSize: 4_812_544,
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
    fileType: 'pdf',
  },
]

// 25 MB upload cap (matches the original upload handler).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function DrawingsModule() {
  const { activeProjectDbId } = useApp()
  const [selectedId, setSelectedId] = useState('DWG-001')
  const [discipline, setDiscipline] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  // Drawings are synced via useSyncedState so uploads persist across refreshes
  // (and to Supabase when configured). The `fieldMap` maps the camelCase app
  // fields to the snake_case columns on the `drawings` table (migration
  // 00000000000013).
  const [drawings, setDrawings, drawingsLoading] = useSyncedState<Dwg[]>(
    'omnisite-drawings',
    'drawings',
    () => DWS,
    {
      fieldMap: {
        fileUrl: 'file_url',
        fileType: 'file_type',
        sourceFileUrl: 'source_file_url',
        fileSize: 'file_size',
      },
      primaryKey: 'id',
    }
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live discipline list — derived from the synced drawings so a new
  // discipline on an upload (e.g. 'Uploaded') appears as its own filter
  // category. 'All' is always first.
  const DISCIPLINES = useMemo(
    () => ['All', ...Array.from(new Set(drawings.map((d) => d.discipline)))],
    [drawings]
  )

  const selected = drawings.find((d) => d.id === selectedId) ?? drawings[0]

  if (drawingsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading drawings…" />
      </div>
    )
  }

  // Guard against an empty drawings store (e.g. fresh install with no seed
  // data, or all drawings deleted). Without this, `selected` is undefined
  // and `<DrawingInspector key={selected.id} dwg={selected} />` below would
  // crash dereferencing it. Placed AFTER all hooks have been called so we
  // don't violate rules-of-hooks.
  if (!selected) {
    return (
      <Workspace3Pane
        leftPane={
          <>
            <PaneHeader title="Disciplines" />
            <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
              No items to display
            </PaneBody>
          </>
        }
        centerPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        rightPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        leftPaneWidth="220px"
        rightPaneWidth="480px"
      />
    )
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Always reset the input value so the same file can be picked again later.
    if (e.target) e.target.value = ''
    if (!file) return

    // Accept by extension — DWG/DXF don't have universally-recognized MIME
    // types, so we trust the file extension (the input's `accept` attribute
    // already filters what the file picker shows).
    const lowerName = file.name.toLowerCase()
    const extOk = DRAWING_ALLOWED_EXTS.some((ext) => lowerName.endsWith(ext))
    if (!extOk) {
      toast.error('Unsupported file type', {
        description: 'Allowed: PDF, DWG, DXF, ZIP, RAR, PNG, JPEG, WebP.',
      })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File too large', {
        description: `Max size is 25 MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      })
      return
    }

    const fileType = detectDrawingFileType(file)
    if (!fileType) {
      toast.error('Could not detect file type', {
        description: `Unknown extension on ${file.name}.`,
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
        return
      }

      // Build a drawing record for the uploaded file. For PDFs / images,
      // the URL points at the file the viewer will render. For DWG/DXF/ZIP/RAR,
      // the URL is the source-file download URL.
      const isViewerType = fileType === 'pdf' || fileType === 'image'
      const newId = `DWG-UP-${Date.now()}`
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const newDwg: Dwg = {
        id: newId,
        number: `${baseName.slice(0, 24).toUpperCase()}`,
        title: file.name,
        revision: 'A',
        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: 'Pending',
        size: '—',
        discipline: 'Uploaded',
        links: [],
        history: [{ rev: 'A', date: new Date().toISOString().slice(0, 10), note: 'File uploaded' }],
        fileType: fileType as DrawingFileType,
        fileUrl: isViewerType ? result.url : undefined,
        sourceFileUrl: isViewerType ? undefined : result.url,
        fileSize: file.size,
      }
      setDrawings((prev) => [newDwg, ...prev])
      setSelectedId(newId)

      toast.success('Drawing uploaded', {
        description: isViewerType
          ? `${file.name} stored in the drawings bucket — viewer + markup ready.`
          : `${file.name} stored as a downloadable ${fileType.toUpperCase()} source file.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Upload failed', { description: msg })
    } finally {
      setUploading(false)
    }
  }

  const filtered = drawings.filter((d) => {
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info('Custom disciplines coming soon', {
                  description:
                    'Use the existing Bridge/Civil/Structural/Mechanical/Electrical types.',
                })
              }
              title="Add discipline (coming soon)"
            >
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
              const count =
                d === 'All' ? drawings.length : drawings.filter((x) => x.discipline === d).length
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
          <PaneHeader title={`Drawings Register · ${filtered.length} of ${drawings.length}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept={DRAWING_ACCEPT_ATTR}
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Upload a drawing (PDF, DWG, DXF, ZIP, RAR, PNG, JPEG, WebP — max 25 MB)"
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
                  [
                    'Number',
                    'Title',
                    'Discipline',
                    'Revision',
                    'Date',
                    'Size',
                    'Status',
                    'FileType',
                    'Size(bytes)',
                  ],
                  filtered.map((d) => [
                    d.number,
                    d.title,
                    d.discipline,
                    d.revision,
                    d.date,
                    d.size,
                    d.status,
                    d.fileType ?? 'pdf',
                    d.fileSize != null ? String(d.fileSize) : '',
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
      rightPaneWidth="480px"
    />
  )
}

// Surface the helper so callers outside the module can format file sizes
// consistently (e.g. the download card already imports it from ./types —
// this re-export is for convenience).
export { formatFileSize }
