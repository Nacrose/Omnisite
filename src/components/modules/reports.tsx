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
import { useApp } from '@/lib/app-store'
import { useSyncedState } from '@/lib/use-synced-state'

// Widget library — `type` drives how the canvas renders the placed widget.
// `cat` is just for grouping in the library pane.
type WidgetType =
  's-curve' | 'boq-table' | 'photo-gallery' | 'weather' | 'heading' | 'paragraph' | 'datetime'

const TEMPLATES = [
  {
    id: 't1',
    name: 'Weekly Progress Report',
    description: 'Date + heading + S-curve + BOQ table',
    widgets: [
      { type: 'datetime' as WidgetType, label: 'Date / Time', text: undefined },
      { type: 'heading' as WidgetType, label: 'Heading', text: '1. Progress this week' },
      { type: 's-curve' as WidgetType, label: 'S-Curve', text: undefined },
      { type: 'heading' as WidgetType, label: 'Heading', text: '2. BOQ items worked' },
      { type: 'boq-table' as WidgetType, label: 'BOQ Table', text: undefined },
    ],
  },
  {
    id: 't2',
    name: 'Monthly Client Report (FIDIC)',
    description: 'Heading + paragraph + S-curve + BOQ table + photo gallery',
    widgets: [
      {
        type: 'heading' as WidgetType,
        label: 'Heading',
        text: 'Monthly Progress Report — FIDIC Clause 4.21',
      },
      {
        type: 'paragraph' as WidgetType,
        label: 'Paragraph',
        text: 'Summary of works completed during the reporting period, including EVM metrics (SPI / CPI), critical path status, and any variations or claims under FIDIC Clause 13.',
      },
      { type: 's-curve' as WidgetType, label: 'S-Curve', text: undefined },
      { type: 'boq-table' as WidgetType, label: 'BOQ Table', text: undefined },
      { type: 'photo-gallery' as WidgetType, label: 'Photo Gallery', text: undefined },
    ],
  },
  {
    id: 't3',
    name: 'RA Bill Backup',
    description: 'Heading + BOQ table + paragraph',
    widgets: [
      { type: 'heading' as WidgetType, label: 'Heading', text: 'Running Account Bill — Backup' },
      { type: 'boq-table' as WidgetType, label: 'BOQ Table', text: undefined },
      {
        type: 'paragraph' as WidgetType,
        label: 'Paragraph',
        text: 'The above BOQ items represent the cumulative executed quantities for this billing period. Rates are as per the contract BOQ. Variations, if any, are documented separately under FIDIC Clause 13.',
      },
    ],
  },
  {
    id: 't4',
    name: 'Safety Monthly Summary',
    description: 'Heading + paragraph + photo gallery',
    widgets: [
      { type: 'heading' as WidgetType, label: 'Heading', text: 'Safety Monthly Summary' },
      {
        type: 'paragraph' as WidgetType,
        label: 'Paragraph',
        text: 'Summary of NCRs, incidents, and near-misses for the reporting period. Includes CAP status + billing-hold releases.',
      },
      { type: 'photo-gallery' as WidgetType, label: 'Photo Gallery', text: undefined },
    ],
  },
]

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
  const { activeProject } = useApp()

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
                toast.info('Start from a template', {
                  description:
                    'Pick one of the templates below — each pre-populates the canvas with relevant widgets.',
                })
              }
              title="New from template"
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
                  onClick={() => {
                    // Load the template — clears the current canvas + adds
                    // the template's widgets. Previously this showed a
                    // "coming soon" toast. (P1-11)
                    setLayout(
                      t.widgets.map((w) => ({
                        id: makeId(),
                        type: w.type,
                        label: w.label,
                        text: w.text,
                      }))
                    )
                    setSelectedId(null)
                    toast.success(`Loaded "${t.name}"`, {
                      description: `${t.widgets.length} widgets placed on the canvas. Click Export PDF to print.`,
                    })
                  }}
                  title={`Load ‘${t.name}’ (${t.widgets.length} widgets)`}
                >
                  <div className="text-xs font-medium">{t.name}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {t.widgets.length} widgets · {t.description}
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
                      {activeProject ?? 'No project selected'}
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
  // Read live tasks from the synced store — same channel the Scheduler
  // module uses, so this widget always reflects the current schedule.
  interface TaskRow {
    id: string
    name?: string
    start_week?: number
    duration?: number
    progress?: number
    baseline_start?: number
    baseline_finish?: number
  }
  const [tasks] = useSyncedState<TaskRow[]>(
    'omnisite-reports-tasks',
    'tasks',
    () => [] as TaskRow[],
    { primaryKey: 'id' }
  )

  if (tasks.length === 0) {
    return (
      <div>
        <div className="mb-2 text-[10px] font-semibold text-slate-700">
          S-Curve · Planned vs Earned
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
          No tasks loaded. Visit the Scheduler module to load the schedule, then return here.
        </div>
      </div>
    )
  }

  // Compute cumulative planned vs earned progress across all leaf tasks.
  // Planned = sum of (duration / total_duration) up to each week.
  // Earned = sum of (duration * progress% / total_duration) up to each week.
  // This is a simplified S-curve — a proper one would use EVM BCWP/BCWS,
  // but for a printable report this gives the right shape.
  // Pass-2: guard against NaN — if any task has a non-finite progress
  // or duration, skip it (don't let one bad row crash the whole chart).
  const safeTasks = tasks.filter(
    (t) =>
      Number.isFinite(t.start_week || 0) &&
      Number.isFinite(t.duration || 0) &&
      Number.isFinite(t.progress || 0)
  )
  const totalDuration = safeTasks.reduce((s, t) => s + (t.duration || 0), 0)
  if (totalDuration === 0) {
    return (
      <div>
        <div className="mb-2 text-[10px] font-semibold text-slate-700">
          S-Curve · Planned vs Earned
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
          Schedule has no duration data — add task durations in the Scheduler.
        </div>
      </div>
    )
  }

  // Walk weeks 0..maxWeek, accumulating planned + earned.
  const maxWeek = Math.max(...safeTasks.map((t) => (t.start_week || 0) + (t.duration || 0)))
  const weeks: number[] = []
  const planned: number[] = []
  const earned: number[] = []
  for (let w = 0; w <= maxWeek; w++) {
    weeks.push(w)
    let p = 0
    let e = 0
    for (const t of safeTasks) {
      const start = t.start_week || 0
      const dur = t.duration || 0
      const finish = start + dur
      const progress = (t.progress || 0) / 100
      if (w >= finish) {
        // Task should be done
        p += dur
        e += dur * progress
      } else if (w >= start) {
        // Task in progress
        p += w - start
        e += (w - start) * progress
      }
    }
    planned.push((p / totalDuration) * 100)
    earned.push((e / totalDuration) * 100)
  }

  // Render as a simple ASCII-style bar chart (no chart library in the
  // reports module — keeps the print output lightweight). Each row is
  // a week; bars are filled with █ chars scaled to the percentage.
  const barWidth = 30
  const fmtBar = (pct: number) => {
    const filled = Math.round((pct / 100) * barWidth)
    return '█'.repeat(filled) + '░'.repeat(barWidth - filled)
  }

  // Sample every Nth week so the chart fits on the page.
  const sampleStep = Math.max(1, Math.ceil(weeks.length / 12))

  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">
        S-Curve · Planned vs Earned (cumulative %)
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3 text-[9px] leading-tight">
        <div className="mb-1 font-mono text-slate-500">
          {'Wk'.padEnd(4)} {'Planned'.padEnd(barWidth + 2)} {'Earned'}
        </div>
        {weeks
          .filter((_, i) => i % sampleStep === 0 || i === weeks.length - 1)
          .map((w, idx) => {
            const i = weeks.indexOf(w)
            return (
              <div key={idx} className="font-mono text-slate-700">
                {String(w).padStart(2, '0')}{' '}
                <span className="text-blue-600">{fmtBar(planned[i])}</span> {planned[i].toFixed(0)}%
                <span className="ml-2 text-emerald-600">{fmtBar(earned[i])}</span>{' '}
                {earned[i].toFixed(0)}%
              </div>
            )
          })}
      </div>
      <div className="mt-1 text-[9px] text-slate-500">
        Cumulative planned vs earned progress across {tasks.length} tasks · {maxWeek} weeks total.
      </div>
    </div>
  )
}

function BoqTableWidget() {
  // Read live BOQ items from the synced store.
  interface BoqRow {
    id: string
    code?: string
    description?: string
    qty?: number
    uom?: string
    rate?: number
    type?: string
  }
  const [boqItems] = useSyncedState<BoqRow[]>(
    'omnisite-reports-boq',
    'boq_items',
    () => [] as BoqRow[],
    { primaryKey: 'id' }
  )

  if (boqItems.length === 0) {
    return (
      <div>
        <div className="mb-2 text-[10px] font-semibold text-slate-700">BOQ Progress Summary</div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
          No BOQ items loaded. Visit the BOQ module to load the bill, then return here.
        </div>
      </div>
    )
  }

  // Show the first 10 priced items (skip headings).
  const priced = boqItems.filter((b) => b.type !== 'Heading' && b.qty && b.rate).slice(0, 10)
  const totalValue = priced.reduce((s, b) => s + (b.qty || 0) * (b.rate || 0), 0)

  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">
        BOQ Progress Summary ({priced.length} of {boqItems.length} items shown)
      </div>
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 pr-2 font-medium">Code</th>
            <th className="py-1 pr-2 font-medium">Description</th>
            <th className="py-1 pr-2 text-right font-medium">Qty</th>
            <th className="py-1 pr-2 font-medium">UOM</th>
            <th className="py-1 pr-2 text-right font-medium">Rate</th>
            <th className="py-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {priced.map((b) => (
            <tr key={b.id} className="border-b border-slate-100 text-slate-700">
              <td className="py-1 pr-2 font-mono">{b.code}</td>
              <td className="max-w-[200px] truncate py-1 pr-2">{b.description}</td>
              <td className="py-1 pr-2 text-right font-mono">{(b.qty || 0).toFixed(2)}</td>
              <td className="py-1 pr-2">{b.uom}</td>
              <td className="py-1 pr-2 text-right font-mono">{(b.rate || 0).toFixed(0)}</td>
              <td className="py-1 text-right font-mono">
                {((b.qty || 0) * (b.rate || 0)).toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold text-slate-900">
            <td colSpan={5} className="py-1 pr-2 text-right">
              Total
            </td>
            <td className="py-1 text-right font-mono">NPR {totalValue.toFixed(0)}</td>
          </tr>
        </tfoot>
      </table>
      {boqItems.length > 10 && (
        <div className="mt-1 text-[9px] text-slate-500">
          Showing first 10 of {boqItems.length} items. Full BOQ available in the BOQ module.
        </div>
      )}
    </div>
  )
}

function PhotoGalleryWidget() {
  // Live DSR entries — used as a proxy for "site photos" since the
  // actual photo URLs live in Supabase Storage (signed URLs that expire
  // in 1 hour, can't be embedded in a print-ready PDF). Instead we show
  // the DSR task names + dates + chainage as a "photo log" table.
  interface DsrRow {
    id: string
    task?: string
    chainage?: string
    date?: string
    has_photos?: boolean
  }
  const [dsrEntries] = useSyncedState<DsrRow[]>(
    'omnisite-reports-dsr',
    'dsr_entries',
    () => [] as DsrRow[],
    { primaryKey: 'id' }
  )

  const withPhotos = dsrEntries.filter((d) => d.has_photos).slice(0, 8)

  if (withPhotos.length === 0) {
    return (
      <div>
        <div className="mb-2 text-[10px] font-semibold text-slate-700">Site Photo Log</div>
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
        <div className="mt-1 text-[9px] text-slate-500">
          No DSR entries with photos this period. Mark has_photos on a DSR entry to include it here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold text-slate-700">
        Site Photo Log ({withPhotos.length} entries)
      </div>
      <div className="space-y-1">
        {withPhotos.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded border border-slate-200 p-1.5 text-[9px]"
          >
            <div className="bg-muted text-muted-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
              <ImageIcon className="h-3 w-3 opacity-50" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{d.task}</div>
              <div className="text-slate-500">
                {d.date} · {d.chainage}
              </div>
            </div>
            <span className="font-mono text-slate-400">{d.id}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[9px] text-slate-500">
        Photos are stored in Supabase Storage (signed URLs, 1h expiry). Print this report from the
        Daily Ops module to embed actual photo thumbnails.
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
