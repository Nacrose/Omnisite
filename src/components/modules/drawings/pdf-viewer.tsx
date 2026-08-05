'use client'

/**
 * PdfViewer — renders an actual PDF file using pdfjs-dist.
 *
 * The PDF is rendered to a <canvas> element on the current page. The parent
 * DrawingViewer positions the MarkupOverlay (Fabric.js canvas) on top of
 * this canvas so markups stay aligned with the rendered page at every zoom
 * level.
 *
 * pdfjs-dist requires a Web Worker. We configure it once on module load
 * using the CDN URL matching the installed pdfjs-dist version — this is
 * the simplest approach for Next.js (the bundled worker requires a custom
 * webpack rule that's easy to get wrong under Next 16 + Turbopack).
 *
 * Props:
 *  - fileUrl:     URL the viewer renders (Supabase public URL).
 *  - pageNumber:  1-based page index to display.
 *  - zoom:        0.5–3 scale factor (1 = 100%).
 *  - onPageCount: called once after the PDF loads with the total page count.
 *  - onError:     called when the PDF fails to load or render.
 *  - onCanvasReady: called after every successful render with the canvas
 *                   element + its CSS pixel size — the MarkupOverlay uses
 *                   this to size + position its Fabric.js canvas.
 */

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Loader2, AlertTriangle } from 'lucide-react'

// Configure the worker once. Using the CDN URL pinned to the installed
// version keeps the worker + API versions in sync (a version mismatch
// throws "API version does not match Worker version" at load time).
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

export interface PdfViewerHandle {
  /** CSS pixel width of the last rendered page (0 before first render). */
  width: number
  /** CSS pixel height of the last rendered page (0 before first render). */
  height: number
  /** The canvas element the PDF was rendered to (null before first render). */
  canvas: HTMLCanvasElement | null
}

interface PdfViewerProps {
  fileUrl: string
  pageNumber: number
  zoom: number
  onPageCount?: (count: number) => void
  onError?: (message: string) => void
  onCanvasReady?: (handle: PdfViewerHandle) => void
}

export function PdfViewer({
  fileUrl,
  pageNumber,
  zoom,
  onPageCount,
  onError,
  onCanvasReady,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  // Keep a handle to the active loading task — its destroy() tears down the
  // worker transport. PDFDocumentProxy only exposes cleanup() (which releases
  // loaded fonts + image caches but keeps the worker alive).
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ─── Load the PDF document when fileUrl changes ──────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMsg(null)

    // Cancel any in-flight render task before loading a new doc.
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        /* cancel throws if already finished — ignore */
      }
      renderTaskRef.current = null
    }
    // Release the previous PDF's resources, then destroy its loading task
    // (which fully tears down the worker transport).
    if (pdfDocRef.current) {
      pdfDocRef.current.cleanup().catch(() => {})
      pdfDocRef.current = null
    }
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy().catch(() => {})
      loadingTaskRef.current = null
    }

    const loadingTask = pdfjsLib.getDocument({
      url: fileUrl,
      // Suppress the open-in-new-tab annotation action (we don't show
      // annotation UI here; markups are handled by the Fabric.js overlay).
      disableAutoFetch: false,
      disableStream: false,
    })
    loadingTaskRef.current = loadingTask

    loadingTask.promise
      .then((pdf) => {
        if (cancelled) {
          // cleanup + destroy the loading task so the worker doesn't leak.
          pdf.cleanup().catch(() => {})
          loadingTask.destroy().catch(() => {})
          return
        }
        pdfDocRef.current = pdf
        onPageCount?.(pdf.numPages)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Failed to load PDF — the file may be corrupt or unreachable.'
        setErrorMsg(msg)
        onError?.(msg)
        setLoading(false)
      })

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
        renderTaskRef.current = null
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.cleanup().catch(() => {})
        pdfDocRef.current = null
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {})
        loadingTaskRef.current = null
      }
    }
    // INTENTIONAL dep exclusion: this effect loads the PDF document when
    // `fileUrl` changes. Other state (pageNumber, zoom) is read from refs
    // and handled by the separate render-page effect below. Re-running this
    // on every page/zoom change would re-fetch the entire PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  // ─── Render the current page whenever pageNumber or zoom changes ─────────
  useEffect(() => {
    const pdf = pdfDocRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return

    let cancelled = false

    // Cancel any in-flight render from a previous page/zoom change.
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        /* ignore */
      }
      renderTaskRef.current = null
    }

    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled || !canvas) return

        // pdfjs viewport — scale = device pixel ratio * zoom so the canvas
        // stays crisp on Retina/HiDPI displays without doubling logical size.
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
        const viewport = page.getViewport({ scale: zoom * dpr })

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        // CSS size = logical pixels (without dpr multiplier) so the canvas
        // displays at the right size in the page flow.
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          const msg = 'Could not acquire 2D canvas context'
          setErrorMsg(msg)
          onError?.(msg)
          return
        }

        const renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        })
        renderTaskRef.current = renderTask

        renderTask.promise
          .then(() => {
            if (cancelled) return
            onCanvasReady?.({
              width: viewport.width / dpr,
              height: viewport.height / dpr,
              canvas,
            })
          })
          .catch((err: unknown) => {
            // RenderingCancelledException is thrown when a new render
            // supersedes this one — not a real error.
            const name = (err as { name?: string })?.name
            if (name === 'RenderingCancelledException') return
            if (cancelled) return
            const msg = err instanceof Error ? err.message : String(err)
            setErrorMsg(msg)
            onError?.(msg)
          })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        onError?.(msg)
      })

    return () => {
      cancelled = true
    }
    // INTENTIONAL dep exclusion: `onPageCount`, `onError` are parent
    // callbacks that change identity on every parent render — including
    // them would re-render the page on every parent state tick. They're
    // read via refs inside the effect so we always call the latest version
    // without re-triggering the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, zoom, loading])

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
      {/* Loading overlay */}
      {loading && (
        <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading PDF…</span>
        </div>
      )}

      {/* Error state */}
      {errorMsg && !loading && (
        <div className="border-destructive/40 bg-destructive/5 m-4 flex max-w-md flex-col items-center gap-2 rounded-md border p-6 text-center">
          <AlertTriangle className="text-destructive h-6 w-6" />
          <div className="text-sm font-semibold">Could not render PDF</div>
          <div className="text-muted-foreground text-xs">{errorMsg}</div>
        </div>
      )}

      {/* The canvas itself */}
      {!errorMsg && (
        <canvas
          ref={canvasRef}
          className="block bg-white shadow-md dark:bg-slate-100"
          style={{ imageRendering: 'auto' }}
        />
      )}
    </div>
  )
}
