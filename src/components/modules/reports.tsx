'use client'

import { useState, useMemo } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  Clock,
  Cloud,
  Table,
  Type,
  Download,
  Save,
  Eye,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'

const TEMPLATES = [
  { id: 't1', name: 'Weekly Progress Report', pages: 4, lastUsed: '3 days ago' },
  { id: 't2', name: 'Monthly Client Report (FIDIC)', pages: 12, lastUsed: '1 week ago' },
  { id: 't3', name: 'RA Bill Backup', pages: 8, lastUsed: '2 weeks ago' },
  { id: 't4', name: 'Safety Monthly Summary', pages: 3, lastUsed: '5 days ago' },
]

// Widget library — `type` drives how the canvas renders the placed widget.
// `cat` is just for grouping in the library pane.
type WidgetType =
  's-curve' | 'boq-table' | 'photo-gallery' | 'weather' | 'heading' | 'paragraph' | 'datetime'

interface WidgetDef {
  type: WidgetType
  name: string
  icon: typeof BarChart3
  cat: string
}

const WIDGETS: WidgetDef[] = [
  { type: 's-curve', name: 'S-Curve', icon: BarChart3, cat: 'Chart' },
  { type: 'boq-table', name: 'BOQ Table', icon: Table, cat: 'Data' },
  { type: 'photo-gallery', name: 'Photo Gallery', icon: ImageIcon, cat: 'Visual' },
  { type: 'weather', name: 'Weather Log', icon: Cloud, cat: 'Data' },
  { type: 'heading', name: 'Heading', icon: Type, cat: 'Text' },
  { type: 'paragraph', name: 'Paragraph', icon: FileText, cat: 'Text' },
  { type: 'datetime', name: 'Date/Time', icon: Calendar, cat: 'Text' },
]

interface PlacedWidget {
  /** Stable client-side id (so dragging/clearing works smoothly). */
  id: string
  type: WidgetType
  /** User-facing label set when the widget is dropped. */
  label: string
  /** Optional text content for text widgets (Heading / Paragraph). */
  text?: string
}

const DEFAULT_LAYOUT: PlacedWidget[] = []

function makeId(): string {
  return `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ReportsModule() {
  // Canvas layout — persisted to localStorage so reloads restore the designer's work.
  const [layout, setLayout] = usePersistentState<PlacedWidget[]>(
    'omnisite-reports-layout',
    () => DEFAULT_LAYOUT
  )
  // The currently selected widget — drives the right inspector pane.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedWidget = useMemo(
    () => layout.find((w) => w.id === selectedId) ?? null,
    [layout, selectedId]
  )

  const addWidget = (def: WidgetDef) => {
    const placed: PlacedWidget = {
      id: makeId(),
      type: def.type,
      label: def.name,
      text: def.type === 'heading' ? 'Section Heading' : def.type === 'paragraph' ? '' : undefined,
    }
    setLayout((prev) => [...prev, placed])
    setSelectedId(placed.id)
    toast.success(`${def.name} added`, { description: 'Layout auto-saved to localStorage.' })
  }

  const removeWidget = (id: string) => {
    setLayout((prev) => prev.filter((w) => w.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const clearCanvas = () => {
    if (layout.length === 0) {
      toast.info('Canvas is already empty')
      return
    }
    setLayout([])
    setSelectedId(null)
    toast.success('Canvas cleared', { description: 'Layout auto-saved to localStorage.' })
  }

  const updateWidgetText = (id: string, text: string) => {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, text } : w)))
  }

  const saveLayout = () => {
    // Layout is already persisted by usePersistentState, but show a toast so
    // the user gets explicit feedback that their work is safe.
    toast.success('Layout saved', {
      description: `${layout.length} widget${layout.length === 1 ? '' : 's'} stored locally.`,
    })
  }

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Templates & Widgets">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info(
                  'Template builder coming soon — drag widgets onto the canvas to create a custom report.'
                )
              }
              title="New template (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-3">
            <div className="text-muted-foreground mb-2 px-3 text-[10px] font-semibold tracking-wider uppercase">
              Templates
            </div>
            <div className="mb-4 space-y-1 px-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className="hover:bg-accent/50 w-full rounded border border-transparent p-2 text-left hover:border-[var(--pane-divider)]"
                  onClick={() =>
                    toast.info(
                      'Template loading coming soon — drag widgets onto the canvas instead.'
                    )
                  }
                  title={`Load ‘${t.name}’ (coming soon)`}
                >
                  <div className="text-xs font-medium">{t.name}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {t.pages} pages · {t.lastUsed}
                  </div>
                </button>
              ))}
            </div>
            <div className="text-muted-foreground mb-2 px-3 text-[10px] font-semibold tracking-wider uppercase">
              Widget Library
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-2">
              {WIDGETS.map((w) => {
                const Icon = w.icon
                return (
                  <button
                    key={w.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('widget-type', w.type)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addWidget(w)}
                    className={cn(
                      'hover:bg-accent/50 flex flex-col items-start gap-1 rounded-md border border-[var(--pane-divider)] p-2 text-left transition-colors'
                    )}
                    title={`Add ${w.name} to canvas`}
                  >
                    <Icon className="text-primary h-4 w-4" />
                    <div className="text-[10px] leading-tight font-medium">{w.name}</div>
                    <div className="text-muted-foreground text-[9px]">{w.cat}</div>
                  </button>
                )
              })}
            </div>
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader
            title={`PDF Canvas · A4 Portrait · ${layout.length} widget${layout.length === 1 ? '' : 's'}`}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                toast.info('Preview uses the browser print dialog — click Export PDF to print.')
              }
              title="Preview (uses browser print)"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={saveLayout}
              title="Layout auto-saves to localStorage"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={clearCanvas}
              title="Remove all widgets"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                toast.info('Preparing PDF…', {
                  description: 'Opening print dialog — save as PDF from the browser.',
                })
                setTimeout(() => window.print(), 300)
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </Button>
          </PaneHeader>
          <PaneBody className="bg-secondary/20 flex justify-center p-6">
            <div
              className="print-report-canvas relative rounded-sm bg-white shadow-lg"
              style={{ width: '595px', minHeight: '842px' }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const type = e.dataTransfer.getData('widget-type') as WidgetType
                if (!type) return
                const def = WIDGETS.find((w) => w.type === type)
                if (def) addWidget(def)
              }}
            >
              {/* Org header */}
              <div className="border-b-2 border-slate-900 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] tracking-wider text-slate-500 uppercase">
                      OmniSite Construction Pvt. Ltd.
                    </div>
                    <div className="text-lg font-bold text-slate-900">Weekly Progress Report</div>
                    <div className="text-[10px] text-slate-500">
                      Kathmandu Ring Road Expansion — Package 3
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                    OS
                  </div>
                </div>
              </div>

              {/* Canvas body */}
              <div className="space-y-3 p-6">
                {layout.length === 0 ? (
                  <div
                    className="rounded-md border-2 border-dashed border-slate-300 p-12 text-center text-[10px] text-slate-400"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'copy'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const type = e.dataTransfer.getData('widget-type') as WidgetType
                      if (!type) return
                      const def = WIDGETS.find((w) => w.type === type)
                      if (def) addWidget(def)
                    }}
                  >
                    Drag a widget here — or click one in the library — to add it to the canvas.
                  </div>
                ) : (
                  layout.map((w) => (
                    <WidgetRenderer
                      key={w.id}
                      widget={w}
                      selected={selectedId === w.id}
                      onSelect={() => setSelectedId(w.id)}
                      onRemove={() => removeWidget(w.id)}
                      onTextChange={(text) => updateWidgetText(w.id, text)}
                    />
                  ))
                )}
              </div>

              {/* Page footer */}
              <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between border-t border-slate-200 px-6 py-3 text-[9px] text-slate-400">
                <span>OmniSite · Weekly Progress Report</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </PaneBody>
        </>
      }
      rightPane={
        <>
          <PaneHeader title="Data Binding Inspector" />
          <PaneBody className="space-y-3 p-4 text-xs">
            <div>
              <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Selected widget
              </div>
              <div
                className={cn(
                  'rounded-md border p-2.5',
                  selectedWidget
                    ? 'border-primary/40 bg-primary/5'
                    : 'bg-secondary/40 border-[var(--pane-divider)]'
                )}
              >
                <div className="font-medium">{selectedWidget?.label ?? 'None'}</div>
                <div className="text-muted-foreground text-[10px]">
                  {selectedWidget
                    ? `${selectedWidget.type} · ${selectedWidget.id}`
                    : 'Click a widget to select it'}
                </div>
              </div>
            </div>

            {selectedWidget && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[10px]">Widget actions</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => removeWidget(selectedWidget.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </>
            )}

            {(selectedWidget?.type === 'heading' || selectedWidget?.type === 'paragraph') &&
              selectedWidget && (
                <>
                  <Separator />
                  <div>
                    <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                      Text content
                    </div>
                    <textarea
                      className="bg-background min-h-[80px] w-full rounded-md border border-[var(--pane-divider)] p-2 text-xs"
                      value={selectedWidget.text ?? ''}
                      onChange={(e) => updateWidgetText(selectedWidget.id, e.target.value)}
                      placeholder={
                        selectedWidget.type === 'heading' ? 'Section heading…' : 'Body paragraph…'
                      }
                    />
                  </div>
                </>
              )}

            <Separator />
            <div>
              <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Data Source
              </div>
              <select className="bg-background h-8 w-full rounded-md border border-[var(--pane-divider)] px-2 text-xs">
                <option>BOQ items with DSR linkage</option>
                <option>BOQ items (all)</option>
                <option>Schedule tasks</option>
                <option>DSR entries (date range)</option>
              </select>
            </div>
            <div>
              <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Filter
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-12 text-[10px]">Date</span>
                  <select className="bg-background h-7 flex-1 rounded border border-[var(--pane-divider)] px-2 text-xs">
                    <option>This week</option>
                    <option>Last 7 days</option>
                    <option>Custom</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-12 text-[10px]">Status</span>
                  <select className="bg-background h-7 flex-1 rounded border border-[var(--pane-divider)] px-2 text-xs">
                    <option>All</option>
                    <option>In progress</option>
                    <option>Completed</option>
                    <option>Delayed</option>
                  </select>
                </div>
              </div>
            </div>
            <Separator />
            <div className="text-muted-foreground text-[10px]">
              Layout auto-saves to localStorage. Use <span className="font-mono">Export PDF</span>{' '}
              to open the browser print dialog.
            </div>
          </PaneBody>
        </>
      }
      leftPaneWidth="260px"
      rightPaneWidth="340px"
    />
  )
}

// ─── Widget renderers ───────────────────────────────────────────────────────
// Each widget type renders its own body. Selecting a widget highlights it
// and shows the remove (X) button.

function WidgetRenderer({
  widget,
  selected,
  onSelect,
  onRemove,
  onTextChange,
}: {
  widget: PlacedWidget
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  onTextChange: (text: string) => void
}) {
  return (
    <div
      className={cn(
        'relative cursor-move rounded-md border p-3 transition-colors',
        selected
          ? 'border-primary ring-primary/30 ring-2'
          : 'border-slate-200 hover:border-slate-400'
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Selection toolbar */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md"
          title="Remove widget"
          aria-label={`Remove ${widget.label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <WidgetBody widget={widget} onTextChange={onTextChange} />
    </div>
  )
}

function WidgetBody({
  widget,
  onTextChange,
}: {
  widget: PlacedWidget
  onTextChange: (text: string) => void
}) {
  switch (widget.type) {
    case 'heading':
      return (
        <input
          className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
          value={widget.text ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Section heading…"
        />
      )
    case 'paragraph':
      return (
        <textarea
          className="min-h-[60px] w-full bg-transparent text-[11px] leading-relaxed text-slate-700 outline-none"
          value={widget.text ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Body paragraph…"
        />
      )
    case 'datetime':
      return <DateTimeWidget />
    case 's-curve':
      return <SCurveWidget />
    case 'boq-table':
      return <BoqTableWidget />
    case 'photo-gallery':
      return <PhotoGalleryWidget />
    case 'weather':
      return <WeatherWidget />
    default:
      return <div className="text-[10px] text-slate-500">Unknown widget</div>
  }
}

function DateTimeWidget() {
  const now = new Date()
  return (
    <div className="flex items-center justify-between text-[10px] text-slate-700">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-slate-500" />
        <span className="font-mono">
          {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-slate-500" />
        <span className="font-mono">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function SCurveWidget() {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">
        S-Curve · Planned vs Earned
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
        S-Curve data requires baseline schedule — configure in Scheduler module.
      </div>
    </div>
  )
}

function BoqTableWidget() {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">BOQ Progress Summary</div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
        BOQ data binding coming soon — drag this widget onto the canvas and configure the data
        source.
      </div>
    </div>
  )
}

function PhotoGalleryWidget() {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">Photo Gallery</div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-muted text-muted-foreground flex aspect-square items-center justify-center rounded"
          >
            <ImageIcon className="h-4 w-4 opacity-50" />
          </div>
        ))}
      </div>
    </div>
  )
}

function WeatherWidget() {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">Weather Log</div>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
        Weather data not configured.
      </div>
    </div>
  )
}
