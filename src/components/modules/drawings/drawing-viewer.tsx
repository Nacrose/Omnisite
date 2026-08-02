'use client'

/**
 * DrawingViewer — combines the PDF viewer + Fabric.js markup overlay.
 *
 * Routes the drawing based on `fileType`:
 *   • pdf / image  → in-browser viewer + markup overlay (full experience)
 *   • dwg / dxf / zip / rar → download-only card (no in-browser rendering)
 *
 * For PDFs:
 *  - renders the PdfViewer at the bottom layer
 *  - overlays the MarkupOverlay (Fabric.js) at the top layer
 *  - renders the MarkupToolbar in a side panel
 *  - loads existing annotations via useSyncedState (drawing_annotations table)
 *  - saves new annotations via the same hook (each annotation is a separate
 *    JSON row — the original PDF file is NEVER modified)
 *  - shows a list of existing annotations (author, timestamp, type)
 *
 * For non-PDF files:
 *  - shows the file type icon, filename, size, and a download button
 *  - shows "Markup not available for this file type" message
 *
 * The viewer state (page, zoom, tool, color, strokeWidth) is owned here so
 * the toolbar and the canvas stay in sync. The Fabric.js overlay receives
 * the canvas dimensions from the PdfViewer's onCanvasReady callback — that
 * way the overlay always matches the PDF's zoom level.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  FileText,
  FileWarning,
  Maximize2,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useSyncedState } from '@/lib/use-synced-state'
import { toast } from 'sonner'
import { PdfViewer, type PdfViewerHandle } from './pdf-viewer'
import { MarkupOverlay, MarkupToolbar, type MarkupOverlayHandle } from './markup-overlay'
import {
  type AnnotationType,
  type Dwg,
  type DrawingAnnotation,
  type StampType,
  fileTypeLabel,
  formatFileSize,
  isViewerSupported,
} from './types'

interface DrawingViewerProps {
  dwg: Dwg
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

export function DrawingViewer({ dwg }: DrawingViewerProps) {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pdfCanvas, setPdfCanvas] = useState<PdfViewerHandle>({
    width: 0,
    height: 0,
    canvas: null,
  })

  // Markup tool state.
  const [activeTool, setActiveTool] = useState<AnnotationType | 'select'>('select')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [activeStamp, setActiveStamp] = useState<StampType>('approved')
  const [dirty, setDirty] = useState(false)

  const overlayRef = useRef<MarkupOverlayHandle>(null)
  // Track which drawing + page the overlay currently has loaded so we
  // know when to reload it (e.g. switching pages or drawings).
  const loadedKeyRef = useRef<string>('')

  // ─── Annotations via useSyncedState (drawing_annotations table) ──────────
  // The hook handles DB → app object mapping via fieldMap. The fabricData
  // field is stored as JSONB in the DB and arrives as a parsed object on
  // read; on write, useSyncedState serializes it back via JSON.stringify
  // for fields it suspects are complex — but since fabric_data is JSONB
  // (not TEXT), the API client passes the object through and PostgREST
  // handles the JSON conversion.
  const [annotations, setAnnotations, annotationsLoading] = useSyncedState<DrawingAnnotation[]>(
    `omnisite-drawing-annotations-${dwg.id}`,
    'drawing_annotations',
    () => [],
    {
      fieldMap: {
        drawingId: 'drawing_id',
        pageNumber: 'page_number',
        authorId: 'author_id',
        authorName: 'author_name',
        strokeWidth: 'stroke_width',
        fabricData: 'fabric_data',
        textContent: 'text_content',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      primaryKey: 'id',
    }
  )

  // Filter annotations for the current page (annotations are stored per-page).
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.pageNumber === page),
    [annotations, page]
  )

  // Load annotations into the Fabric.js overlay whenever the drawing or page
  // changes. We use a key string so the same effect handles both cases.
  const loadKey = `${dwg.id}:${page}`
  useEffect(() => {
    if (loadKey === loadedKeyRef.current) return
    if (!overlayRef.current) return
    overlayRef.current.load(pageAnnotations)
    loadedKeyRef.current = loadKey
    setDirty(false)
    // We intentionally exclude pageAnnotations from the deps — we want this
    // to fire only on drawing/page change, not when annotations update from
    // the realtime channel (the overlay is the source of truth between saves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey])

  // ─── Save handler ──────────────────────────────────────────────────────
  const handleSave = useCallback(
    (newAnnotations: DrawingAnnotation[]) => {
      if (!user) {
        toast.error('Sign in required', {
          description: 'You must be signed in to save markups.',
        })
        return
      }

      // Replace all annotations for this page with the new set.
      // (The original PDF file is never modified — only the JSON rows.)
      const otherPages = annotations.filter((a) => a.pageNumber !== page)
      const merged = [...otherPages, ...newAnnotations]
      setAnnotations(merged)
      toast.success('Markups saved', {
        description: `${newAnnotations.length} annotation${newAnnotations.length === 1 ? '' : 's'} on page ${page}.`,
      })
    },
    [annotations, page, setAnnotations, user]
  )

  // ─── PDF canvas → overlay sizing ───────────────────────────────────────
  const handleCanvasReady = useCallback((handle: PdfViewerHandle) => {
    setPdfCanvas(handle)
  }, [])

  const handlePdfError = useCallback((msg: string) => {
    toast.error('PDF render failed', { description: msg })
  }, [])

  // ─── Page / zoom controls ──────────────────────────────────────────────
  const goPrevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), [])
  const goNextPage = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages])
  const zoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2))), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2))), [])
  const zoomReset = useCallback(() => setZoom(1), [])

  const isPdf = isViewerSupported(dwg.fileType)
  const fileUrl = dwg.fileUrl ?? dwg.sourceFileUrl ?? ''

  // ─── Non-PDF (DWG/DXF/ZIP/RAR) — download-only card ────────────────────
  if (!isPdf || !fileUrl) {
    return (
      <div className="m-4">
        <NonPdfCard dwg={dwg} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page + zoom controls (top bar) */}
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-[var(--pane-divider)] px-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={goPrevPage}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-1 font-mono text-[10px] tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={goNextPage}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="text-muted-foreground truncate px-2 text-[10px]">
          {dwg.number} · Rev {dwg.revision}
          {dirty && <span className="text-amber-600 dark:text-amber-400"> · unsaved</span>}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center font-mono text-[10px] tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={zoomReset}>
            Reset
          </Button>
          <div className="mx-1 h-4 w-px bg-[var(--pane-divider)]" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Fullscreen (coming soon)"
            disabled
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main viewer area — PDF + Fabric overlay */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        <div className="grid-bg absolute inset-0 opacity-30" />

        {/* PDF layer */}
        <PdfViewer
          fileUrl={fileUrl}
          pageNumber={page}
          zoom={zoom}
          onPageCount={setTotalPages}
          onError={handlePdfError}
          onCanvasReady={handleCanvasReady}
        />

        {/* Fabric.js markup overlay — positioned absolutely on top of the PDF.
            The overlay canvas is sized to match the PDF page (via setDimensions
            in the overlay's effect). We wrap it in a div that sits on top of
            the PDF canvas at the same offset. */}
        {pdfCanvas.width > 0 && pdfCanvas.height > 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-4"
            style={{ overflow: 'auto' }}
          >
            <div
              className="pointer-events-auto relative"
              style={{ width: pdfCanvas.width, height: pdfCanvas.height }}
            >
              <MarkupOverlay
                ref={overlayRef}
                width={pdfCanvas.width}
                height={pdfCanvas.height}
                activeTool={activeTool}
                color={color}
                strokeWidth={strokeWidth}
                activeStamp={activeStamp}
                authorId={user?.id ?? 'anonymous'}
                authorName={user?.name ?? 'Anonymous'}
                drawingId={dwg.id}
                pageNumber={page}
                onSave={handleSave}
                onDirtyChange={setDirty}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right-side toolbar — visible only when there's a PDF. On wide
          screens it's a flex column beside the canvas; on narrow screens
          it collapses to a top toolbar. We render it inline here so the
          viewer is self-contained. */}
      <div className="flex h-32 flex-shrink-0 flex-col gap-2 border-t border-[var(--pane-divider)] p-3 md:h-36">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MarkupToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            color={color}
            onColorChange={setColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            activeStamp={activeStamp}
            onActiveStampChange={setActiveStamp}
          />

          {/* Annotation list — author + timestamp + type per row. */}
          <div className="col-span-1 md:col-span-2">
            <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <MessageSquare className="h-3 w-3" />
              Annotations on this page
              {annotationsLoading && <span className="text-[9px] opacity-60">(loading…)</span>}
            </div>
            <div className="max-h-20 overflow-y-auto text-[10px] md:max-h-24">
              {pageAnnotations.length === 0 ? (
                <div className="text-muted-foreground py-2 text-center">
                  No annotations yet. Pick a tool and start drawing.
                </div>
              ) : (
                pageAnnotations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 border-b border-[var(--pane-divider)] py-1"
                  >
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    <Badge variant="outline" className="text-[9px]">
                      {a.type}
                    </Badge>
                    {a.textContent && (
                      <span className="truncate text-[10px] font-medium">{a.textContent}</span>
                    )}
                    <span className="text-muted-foreground ml-auto truncate text-[9px]">
                      {a.authorName} · {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Non-PDF card (DWG / DXF / ZIP / RAR) ─────────────────────────────────────

function NonPdfCard({ dwg }: { dwg: Dwg }) {
  const fileType = dwg.fileType ?? 'pdf'
  const downloadUrl = dwg.sourceFileUrl ?? dwg.fileUrl
  const isArchive = fileType === 'zip' || fileType === 'rar'
  const isCad = fileType === 'dwg' || fileType === 'dxf'

  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-[var(--pane-divider)] bg-gradient-to-br from-slate-100 to-slate-200 p-8 text-center dark:from-slate-800 dark:to-slate-900">
      <div className="bg-background/80 mb-3 flex h-16 w-16 items-center justify-center rounded-full shadow-sm">
        {isArchive ? (
          <FileWarning className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        ) : (
          <FileText className="text-muted-foreground h-8 w-8" />
        )}
      </div>
      <div className="mb-1 text-sm font-semibold">{fileTypeLabel(fileType)}</div>
      <div className="text-muted-foreground mb-3 max-w-sm text-xs">
        {dwg.number} · Rev {dwg.revision}
        {dwg.fileSize ? ` · ${formatFileSize(dwg.fileSize)}` : ''}
      </div>

      <div className="text-muted-foreground mb-4 max-w-md text-xs leading-relaxed">
        {isCad && (
          <>
            CAD source files (DWG/DXF) cannot be rendered in the browser. Download the file and open
            it in AutoCAD, BricsCAD, or a free viewer like the Autodesk Viewer.
          </>
        )}
        {isArchive && (
          <>
            Compressed archives (ZIP/RAR) contain bundled source files. Download and extract to
            access the contents.
          </>
        )}
        {!isCad && !isArchive && <>Markup is not available for this file type.</>}
      </div>

      {downloadUrl ? (
        <Button asChild size="sm" variant="default">
          <a href={downloadUrl} download={`${dwg.number}-Rev${dwg.revision}`}>
            <Download className="h-3.5 w-3.5" />
            Download {fileTypeLabel(fileType)}
          </a>
        </Button>
      ) : (
        <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] px-4 py-2 text-xs">
          No source file attached to this drawing record yet.
        </div>
      )}
    </div>
  )
}
