'use client'

import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOTAL_WEEKS, WEEK_WIDTH, type Task, type DragState } from './types'

export interface GanttCanvasProps {
  tasks: Task[]
  expanded: Set<string>
  selectedId: string
  onSelect: (id: string) => void
  hoveredId: string | null
  onHover: (id: string | null) => void
  dragging: DragState
  onToggleExpand: (id: string) => void
  onBarMouseDown: (e: React.MouseEvent, t: Task) => void
  onResizeMouseDown: (e: React.MouseEvent, t: Task) => void
  showResources: boolean
  todayWeek: number
  canvasRef: React.RefObject<HTMLDivElement | null>
}

export function GanttCanvas({
  tasks,
  expanded,
  selectedId,
  onSelect,
  hoveredId,
  onHover,
  dragging,
  onToggleExpand,
  onBarMouseDown,
  onResizeMouseDown,
  showResources,
  todayWeek,
  canvasRef,
}: GanttCanvasProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Gantt canvas */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Week ruler */}
          <div className="vibrancy sticky top-0 z-10 flex h-8 border-b border-[var(--pane-divider)]">
            <div className="text-muted-foreground flex w-[480px] flex-shrink-0 items-center border-r border-[var(--pane-divider)] px-3 text-[10px] font-semibold tracking-wider uppercase">
              Task
            </div>
            <div className="flex" style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}>
              {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                const isMonthStart = i % 4 === 0
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-shrink-0 items-center justify-center border-r border-[var(--pane-divider)] text-center text-[10px]',
                      isMonthStart ? 'text-foreground font-semibold' : 'text-muted-foreground'
                    )}
                    style={{ width: WEEK_WIDTH }}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Task rows with gantt bars */}
          <div ref={canvasRef} className="relative">
            {(() => {
              const rows: React.ReactNode[] = []
              const walk = (items: Task[], depth: number) => {
                for (const t of items) {
                  const isExpanded = expanded.has(t.id)
                  const hasChildren = t.children && t.children.length > 0
                  const isSelected = t.id === selectedId
                  const isHovered = hoveredId === t.id
                  const isDragging = dragging?.id === t.id
                  const left = t.start * WEEK_WIDTH
                  const width = Math.max(t.duration * WEEK_WIDTH, t.type === 'Milestone' ? 12 : 6)
                  const baseLeft = t.baseline[0] * WEEK_WIDTH
                  const baseWidth = Math.max((t.baseline[1] - t.baseline[0]) * WEEK_WIDTH, 4)
                  const varianceWeeks = t.start - t.baseline[0]
                  rows.push(
                    <div
                      key={t.id}
                      onClick={() => onSelect(t.id)}
                      className={cn(
                        'row-hover flex cursor-pointer items-stretch border-b border-[var(--pane-divider)] transition-colors',
                        isSelected && 'bg-accent/40',
                        t.critical && 'bg-red-500/5'
                      )}
                    >
                      <div
                        className="flex w-[480px] flex-shrink-0 items-center border-r border-[var(--pane-divider)] text-xs"
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                      >
                        <div className="w-6">
                          {hasChildren && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleExpand(t.id)
                              }}
                              className="p-0.5"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        <span className="text-muted-foreground w-16 font-mono text-[10px]">
                          {t.id}
                        </span>
                        <span
                          className={cn(
                            'truncate',
                            t.type === 'Summary' && 'font-semibold',
                            t.critical && 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {t.name}
                        </span>
                        {varianceWeeks !== 0 && t.type === 'Work' && (
                          <span
                            className={cn(
                              'ml-2 rounded px-1 font-mono text-[9px]',
                              varianceWeeks > 0
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            )}
                          >
                            {varianceWeeks > 0 ? '+' : ''}
                            {varianceWeeks}w
                          </span>
                        )}
                      </div>
                      <div
                        className="gantt-grid relative h-8"
                        style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}
                      >
                        {/* Baseline ghost */}
                        <div
                          className="border-muted-foreground/40 bg-muted-foreground/5 absolute top-2.5 h-3 rounded-sm border border-dashed"
                          style={{ left: baseLeft, width: baseWidth }}
                        />
                        {/* Bar */}
                        {t.type === 'Milestone' ? (
                          <div
                            className="absolute top-1/2 h-0 w-0 -translate-y-1/2"
                            style={{
                              left: left - 6,
                              borderLeft: '6px solid transparent',
                              borderRight: '6px solid transparent',
                              borderBottom: '10px solid var(--warning)',
                            }}
                          />
                        ) : (
                          <div
                            onMouseDown={(e) => onBarMouseDown(e, t)}
                            onMouseEnter={() => onHover(t.id)}
                            onMouseLeave={() => onHover(null)}
                            className={cn(
                              'group absolute top-1.5 flex h-5 items-center overflow-hidden rounded-sm px-1.5 text-[9px] font-medium text-white shadow-sm transition-shadow',
                              isDragging &&
                                'z-30 scale-y-110 cursor-grabbing shadow-lg ring-2 ring-white/50',
                              !isDragging && 'cursor-grab hover:shadow-md',
                              t.type === 'Summary' && 'bg-muted-foreground/60 cursor-default',
                              t.type === 'Hammock' &&
                                'bg-gradient-to-r from-violet-500 to-purple-500',
                              t.type === 'Work' && (t.critical ? 'bg-red-500' : 'bg-primary')
                            )}
                            style={{ left, width }}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-black/20"
                              style={{ width: `${t.progress}%` }}
                            />
                            <span className="pointer-events-none relative z-10 truncate">
                              {t.duration}w · {t.progress}%
                            </span>
                            {/* Resize handles — left edge moves, right edge resizes duration */}
                            {t.type !== 'Summary' && (
                              <>
                                <div
                                  className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize bg-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/70"
                                  onMouseDown={(e) => onBarMouseDown(e, t)}
                                />
                                <div
                                  className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-white/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/70"
                                  onMouseDown={(e) => onResizeMouseDown(e, t)}
                                />
                              </>
                            )}
                            {/* Hover tooltip */}
                            {isHovered && !isDragging && (
                              <div className="pane text-foreground pointer-events-none absolute -top-7 left-1/2 z-40 -translate-x-1/2 rounded border border-[var(--pane-divider)] px-1.5 py-0.5 text-[9px] whitespace-nowrap shadow-md">
                                Wk {t.start + 1} → Wk {t.start + t.duration + 1} · drag body or left
                                edge to move, right edge to resize
                              </div>
                            )}
                          </div>
                        )}
                        {/* Critical path dependency arrow (simple visual) */}
                        {t.critical && t.type === 'Work' && (
                          <div
                            className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-red-500"
                            style={{ left: left - 4 }}
                          />
                        )}
                      </div>
                    </div>
                  )
                  if (hasChildren && isExpanded) walk(t.children!, depth + 1)
                }
              }
              walk(tasks, 0)
              return rows
            })()}
            {/* Today vertical line */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
              style={{ left: `calc(480px + ${todayWeek * WEEK_WIDTH}px)` }}
            >
              <div className="absolute -top-0 -translate-x-1/2 rounded-b bg-red-500 px-1 py-0.5 text-[9px] font-semibold text-white">
                TODAY
              </div>
            </div>
          </div>

          {/* Resource usage panel (toggle) */}
          {showResources && (
            <div className="bg-secondary/20 border-t-2 border-[var(--pane-divider)]">
              <div className="text-muted-foreground px-3 py-2 text-[10px] font-semibold tracking-wider uppercase">
                Resource Usage · Weekly hours
              </div>
              <div className="relative h-32">
                <div className="absolute inset-0 flex">
                  <div className="flex w-[480px] flex-shrink-0 flex-col justify-center gap-1 border-r border-[var(--pane-divider)] px-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-sm bg-blue-500" /> Mason (Skilled)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-sm bg-emerald-500" /> Mazdoor (Unskilled)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-sm bg-amber-500" /> Mixer Operator
                    </div>
                  </div>
                  <div className="relative flex-1">
                    {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                      const mason = 30 + 25 * Math.sin(i / 3)
                      const maz = 50 + 30 * Math.cos(i / 4)
                      const mx = 10 + 5 * Math.sin(i / 2)
                      return (
                        <div
                          key={i}
                          className="group absolute bottom-0 flex flex-col items-center justify-end"
                          style={{ left: i * WEEK_WIDTH, width: WEEK_WIDTH }}
                        >
                          <div
                            className="w-full bg-blue-500/70 group-hover:bg-blue-500"
                            style={{ height: `${mason}px` }}
                          />
                          <div
                            className="w-full bg-emerald-500/70 group-hover:bg-emerald-500"
                            style={{ height: `${maz}px` }}
                          />
                          <div className="w-full bg-amber-500/70" style={{ height: `${mx}px` }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
