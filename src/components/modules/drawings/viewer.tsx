'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Maximize2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import type { Dwg } from './index'

/**
 * DrawingViewer — the PDF viewer area with zoom + page navigation.
 *
 * Renders a placeholder A4/A1 page (SVG mockup of a bridge drawing) that
 * scales with the zoom level. Page count is derived from the drawing's
 * sheet size (A1 = 4 pages, A2 = 2 pages, others = 1).
 *
 * The markup toolbar and fullscreen button are disabled placeholders —
 * they hint at the eventual markup/redline UX without wiring up real
 * canvas interactions yet.
 */
export function DrawingViewer({ dwg }: { dwg: Dwg }) {
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const totalPages = dwg.size === 'A1' ? 4 : dwg.size === 'A2' ? 2 : 1

  return (
    <div className="m-4">
      {/* Viewer area */}
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-md border border-[var(--pane-divider)] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"
        style={{ height: `${300 * zoom}px` }}
      >
        <div className="grid-bg absolute inset-0 opacity-30" />
        {/* Simulated page content — scales with zoom */}
        <div className="relative z-10 transition-transform" style={{ transform: `scale(${zoom})` }}>
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
  )
}
