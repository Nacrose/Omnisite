'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  FileText,
  Image,
  BarChart3,
  Calendar,
  Cloud,
  Table,
  Type,
  Download,
  Save,
  Eye,
  Layout,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TEMPLATES = [
  { id: 't1', name: 'Weekly Progress Report', pages: 4, lastUsed: '3 days ago' },
  { id: 't2', name: 'Monthly Client Report (FIDIC)', pages: 12, lastUsed: '1 week ago' },
  { id: 't3', name: 'RA Bill Backup', pages: 8, lastUsed: '2 weeks ago' },
  { id: 't4', name: 'Safety Monthly Summary', pages: 3, lastUsed: '5 days ago' },
]

const WIDGETS = [
  { id: 'w1', name: 'S-Curve', icon: BarChart3, cat: 'Chart' },
  { id: 'w2', name: 'BOQ Table', icon: Table, cat: 'Data' },
  { id: 'w3', name: 'Photo Gallery', icon: Image, cat: 'Visual' },
  { id: 'w4', name: 'Weather Log', icon: Cloud, cat: 'Data' },
  { id: 'w5', name: 'Manpower Summary', icon: BarChart3, cat: 'Chart' },
  { id: 'w6', name: 'Mini-Gantt', icon: Layout, cat: 'Chart' },
  { id: 'w7', name: 'Cash Flow', icon: BarChart3, cat: 'Chart' },
  { id: 'w8', name: 'Heading', icon: Type, cat: 'Text' },
  { id: 'w9', name: 'Paragraph', icon: Type, cat: 'Text' },
  { id: 'w10', name: 'Date/Time', icon: Calendar, cat: 'Text' },
]

export function ReportsModule() {
  const [selectedWidget, setSelectedWidget] = useState<string | null>('w2')

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Templates & Widgets">
            <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
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
                  disabled
                  title="Coming soon"
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
                    key={w.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('widget', w.id)}
                    onClick={() => setSelectedWidget(w.id)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors',
                      selectedWidget === w.id
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent/50 border-[var(--pane-divider)]'
                    )}
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
          <PaneHeader title="PDF Canvas · A4 Portrait">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled
              title="Coming soon"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled
              title="Coming soon"
            >
              <Save className="h-3.5 w-3.5" />
              Save
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
            {/* A4 mock canvas */}
            <div
              className="print-report-canvas relative rounded-sm bg-white shadow-lg"
              style={{ width: '595px', minHeight: '842px' }}
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
                      Kathmandu Ring Road Expansion — Package 3 · Wk 28
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                    OS
                  </div>
                </div>
              </div>

              {/* Drop zones */}
              <div className="space-y-3 p-6">
                <div className="text-[10px] tracking-wider text-slate-400 uppercase">
                  Section 1 — Project Summary
                </div>

                {/* S-Curve widget */}
                <div
                  className="cursor-move rounded-md border border-slate-200 p-3 hover:border-slate-400"
                  onClick={() => setSelectedWidget('w1')}
                >
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">
                    S-Curve · Planned vs Earned
                  </div>
                  <div className="flex h-32 items-end gap-1">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const planned = 5 + i * 5
                      const earned = Math.max(0, planned - 3)
                      return (
                        <div key={i} className="flex flex-1 flex-col gap-0.5">
                          <div
                            className="rounded-t bg-slate-300"
                            style={{ height: `${planned * 1.5}px` }}
                          />
                          <div
                            className="rounded-b bg-blue-600"
                            style={{ height: `${earned * 1.5}px` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* BOQ table widget */}
                <div
                  className="cursor-move rounded-md border border-slate-200 p-3 hover:border-slate-400"
                  onClick={() => setSelectedWidget('w2')}
                >
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">
                    BOQ Progress Summary
                  </div>
                  <table className="w-full text-[10px] text-slate-700">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-1 text-left">Code</th>
                        <th className="p-1 text-left">Description</th>
                        <th className="p-1 text-right">Planned</th>
                        <th className="p-1 text-right">Actual</th>
                        <th className="p-1 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['1.1.1', 'Excavation in ordinary soil', '1,240', '1,240', '100'],
                        ['1.1.3', 'PCC M15 below footing', '145', '87', '60'],
                        ['2.1.1', 'Excavation for road formation', '18,500', '14,200', '77'],
                      ].map((r) => (
                        <tr key={r[0]} className="border-t border-slate-100">
                          <td className="p-1 font-mono">{r[0]}</td>
                          <td className="p-1">{r[1]}</td>
                          <td className="p-1 text-right">{r[2]}</td>
                          <td className="p-1 text-right">{r[3]}</td>
                          <td className="p-1 text-right font-medium">{r[4]}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Photo gallery widget */}
                <div
                  className="cursor-move rounded-md border border-slate-200 p-3 hover:border-slate-400"
                  onClick={() => setSelectedWidget('w3')}
                >
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">
                    Photo Gallery · Week 28
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="aspect-square rounded bg-gradient-to-br from-slate-300 to-slate-400"
                      />
                    ))}
                  </div>
                </div>

                {/* Weather widget */}
                <div
                  className="cursor-move rounded-md border border-slate-200 p-3 hover:border-slate-400"
                  onClick={() => setSelectedWidget('w4')}
                >
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">Weather Log</div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[9px]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                      <div key={i} className="rounded bg-slate-50 p-1">
                        <div className="font-medium">{d}</div>
                        <div className="text-slate-500">{24 + i}°</div>
                        <div className="text-slate-400">{i < 5 ? '☀' : '☂'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drop target */}
                <div
                  className="rounded-md border-2 border-dashed border-slate-300 p-6 text-center text-[10px] text-slate-400"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('widget')
                    const w = WIDGETS.find((x) => x.id === id)
                    if (w) {
                      setSelectedWidget(id)
                      toast.success(`${w.name} added`, {
                        description: 'Widget dropped onto the canvas.',
                      })
                    }
                  }}
                >
                  Drag a widget here to add it to the page
                </div>
              </div>

              {/* Page footer */}
              <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between border-t border-slate-200 px-6 py-3 text-[9px] text-slate-400">
                <span>OmniSite · Weekly Progress Report · Wk 28</span>
                <span>Page 1 of 4 · Generated 30 Jul 2026</span>
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
              <div className="border-primary/40 bg-primary/5 rounded-md border p-2.5">
                <div className="font-medium">
                  {selectedWidget
                    ? (WIDGETS.find((w) => w.id === selectedWidget)?.name ?? 'None')
                    : 'None'}
                </div>
                <div className="text-muted-foreground text-[10px]">Section 1 · Page 1</div>
              </div>
            </div>
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
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-12 text-[10px]">Discipline</span>
                  <select className="bg-background h-7 flex-1 rounded border border-[var(--pane-divider)] px-2 text-xs">
                    <option>All</option>
                    <option>Bridge</option>
                    <option>Roads</option>
                    <option>Drainage</option>
                  </select>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Columns (toggle)
              </div>
              <div className="space-y-1">
                {[
                  'Code',
                  'Description',
                  'UOM',
                  'Planned Qty',
                  'Actual Qty',
                  '% Done',
                  'Variance',
                  'RA Rate',
                  'Amount',
                ].map((c, i) => (
                  <label key={c} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={i < 6} className="h-3.5 w-3.5" />
                    <span className="text-[11px]">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                Conditional Formatting
              </div>
              <div className="space-y-1.5">
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px]">
                  <div className="font-medium">Delayed items</div>
                  <div className="text-muted-foreground">
                    Highlight row in red if variance &lt; -10%
                  </div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px]">
                  <div className="font-medium">Completed items</div>
                  <div className="text-muted-foreground">Green badge if % done = 100</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full gap-1 text-xs"
                  disabled
                  title="Coming soon"
                >
                  <Plus className="h-3 w-3" />
                  Add rule
                </Button>
              </div>
            </div>
            <Separator />
            <div className="text-muted-foreground text-[10px]">
              Uses browser print dialog (Ctrl+P / Cmd+P). Save as PDF from the print dialog for a
              print-ready output with Org Logo and Page Numbers.
            </div>
          </PaneBody>
        </>
      }
      leftPaneWidth="260px"
      rightPaneWidth="340px"
    />
  )
}
