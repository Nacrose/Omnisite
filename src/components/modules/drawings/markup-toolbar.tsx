'use client'

import { Pencil, Square, Circle as CircleIcon, Type, Stamp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnnotationType, StampType } from './types'

// ─── Constants (shared between MarkupOverlay and MarkupToolbar) ─────────────

export const COLORS = [
  { name: 'red', value: '#ef4444' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#22c55e' },
  { name: 'amber', value: '#f59e0b' },
  { name: 'black', value: '#0f172a' },
] as const

export const STROKE_WIDTHS = [1, 2, 4, 6] as const

export const STAMPS: { type: StampType; label: string; color: string; bg: string }[] = [
  { type: 'approved', label: 'APPROVED', color: '#16a34a', bg: '#dcfce7' },
  { type: 'rejected', label: 'REJECTED', color: '#dc2626', bg: '#fee2e2' },
  { type: 'revision', label: 'REVISE', color: '#d97706', bg: '#fef3c7' },
  { type: 'review', label: 'REVIEW', color: '#2563eb', bg: '#dbeafe' },
]

interface MarkupToolbarProps {
  activeTool: AnnotationType | 'select'
  onToolChange: (tool: AnnotationType | 'select') => void
  color: string
  onColorChange: (color: string) => void
  strokeWidth: number
  onStrokeWidthChange: (w: number) => void
  activeStamp: StampType
  onActiveStampChange: (s: StampType) => void
}

export function MarkupToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  activeStamp,
  onActiveStampChange,
}: MarkupToolbarProps) {
  const tools: { id: AnnotationType | 'select'; icon: typeof Pencil; label: string }[] = [
    { id: 'select', icon: Pencil, label: 'Select' },
    { id: 'freehand', icon: Pencil, label: 'Freehand' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: CircleIcon, label: 'Circle' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'stamp', icon: Stamp, label: 'Stamp' },
  ]

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Markup Tools
      </div>
      <div className="grid grid-cols-4 gap-1">
        {tools.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => onToolChange(t.id)}
              className={cn(
                'flex h-8 items-center justify-center rounded border text-[10px] transition-colors',
                activeTool === t.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-accent border-[var(--pane-divider)]'
              )}
              title={t.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
      </div>

      {/* Color picker */}
      <div>
        <div className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">Color</div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-transform',
                color === c.value
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-110'
              )}
              style={{ backgroundColor: c.value }}
              title={c.name}
              aria-label={`Color: ${c.name}`}
            />
          ))}
        </div>
      </div>

      {/* Stroke width */}
      <div>
        <div className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
          Stroke Width
        </div>
        <div className="flex gap-1">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => onStrokeWidthChange(w)}
              className={cn(
                'flex h-7 flex-1 items-center justify-center rounded border text-[10px] transition-colors',
                strokeWidth === w
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-accent border-[var(--pane-divider)]'
              )}
            >
              {w}px
            </button>
          ))}
        </div>
      </div>

      {/* Stamp selector (only visible when stamp tool is active) */}
      {activeTool === 'stamp' && (
        <div>
          <div className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
            Stamp Type
          </div>
          <div className="grid grid-cols-2 gap-1">
            {STAMPS.map((s) => (
              <button
                key={s.type}
                onClick={() => onActiveStampChange(s.type)}
                className={cn(
                  'rounded border px-2 py-1 text-[10px] font-bold transition-colors',
                  activeStamp === s.type
                    ? 'border-primary'
                    : 'hover:bg-accent border-[var(--pane-divider)]'
                )}
                style={{ color: s.color, backgroundColor: s.bg }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
