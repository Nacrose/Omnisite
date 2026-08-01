'use client'

import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CollaboratorCursors } from '@/components/collaborator-cursors'
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Gantt canvas */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Week ruler */}
          <div className="sticky top-0 z-10 flex h-8 vibrancy border-b border-[var(--pane-divider)]">
            <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex items-center px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Task
            </div>
            <div className="flex" style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}>
              {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                const isMonthStart = i % 4 === 0
                const isWeekend = false
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex-shrink-0 text-center text-[10px] border-r border-[var(--pane-divider)] flex items-center justify-center',
                      isMonthStart ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      isWeekend && 'gantt-weekend'
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
                        'flex items-stretch border-b border-[var(--pane-divider)] cursor-pointer row-hover transition-colors',
                        isSelected && 'bg-accent/40',
                        t.critical && 'bg-red-500/5'
                      )}
                    >
                      <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex items-center text-xs" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                        <div className="w-6">
                          {hasChildren && (
                            <button onClick={e => { e.stopPropagation(); onToggleExpand(t.id) }} className="p-0.5">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                        <span className="w-16 font-mono text-muted-foreground text-[10px]">{t.id}</span>
                        <span className={cn('truncate', t.type === 'Summary' && 'font-semibold', t.critical && 'text-red-600 dark:text-red-400')}>{t.name}</span>
                        {varianceWeeks !== 0 && t.type === 'Work' && (
                          <span className={cn('ml-2 text-[9px] font-mono px-1 rounded', varianceWeeks > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
                            {varianceWeeks > 0 ? '+' : ''}{varianceWeeks}w
                          </span>
                        )}
                      </div>
                      <div className="relative h-8 gantt-grid" style={{ width: TOTAL_WEEKS * WEEK_WIDTH }}>
                        {/* Baseline ghost */}
                        <div
                          className="absolute h-3 top-2.5 rounded-sm border border-dashed border-muted-foreground/40 bg-muted-foreground/5"
                          style={{ left: baseLeft, width: baseWidth }}
                        />
                        {/* Bar */}
                        {t.type === 'Milestone' ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-0 h-0"
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
                              'absolute top-1.5 h-5 rounded-sm flex items-center px-1.5 text-[9px] text-white font-medium overflow-hidden shadow-sm group transition-shadow',
                              isDragging && 'shadow-lg ring-2 ring-white/50 cursor-grabbing scale-y-110 z-30',
                              !isDragging && 'cursor-grab hover:shadow-md',
                              t.type === 'Summary' && 'bg-muted-foreground/60 cursor-default',
                              t.type === 'Hammock' && 'bg-gradient-to-r from-violet-500 to-purple-500',
                              t.type === 'Work' && (t.critical ? 'bg-red-500' : 'bg-primary'),
                            )}
                            style={{ left, width }}
                          >
                            <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${t.progress}%` }} />
                            <span className="relative z-10 truncate pointer-events-none">{t.duration}w · {t.progress}%</span>
                            {/* Resize handles — left edge moves, right edge resizes duration */}
                            {t.type !== 'Summary' && (
                              <>
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-2 bg-white/40 opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-white/70"
                                  onMouseDown={(e) => onBarMouseDown(e, t)}
                                />
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-white/70"
                                  onMouseDown={(e) => onResizeMouseDown(e, t)}
                                />
                              </>
                            )}
                            {/* Hover tooltip */}
                            {isHovered && !isDragging && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 pane border border-[var(--pane-divider)] rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap shadow-md z-40 pointer-events-none">
                                Wk {t.start + 1} → Wk {t.start + t.duration + 1} · drag body or left edge to move, right edge to resize
                              </div>
                            )}
                          </div>
                        )}
                        {/* Critical path dependency arrow (simple visual) */}
                        {t.critical && t.type === 'Work' && (
                          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-red-500" style={{ left: left - 4 }} />
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
              className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
              style={{ left: `calc(480px + ${todayWeek * WEEK_WIDTH}px)` }}
            >
              <div className="absolute -top-0 -translate-x-1/2 px-1 py-0.5 bg-red-500 text-white text-[9px] rounded-b font-semibold">TODAY</div>
            </div>

            {/* Live collaborator cursors (simulated WebSocket presence) */}
            <CollaboratorCursors />
          </div>

          {/* Resource usage panel (toggle) */}
          {showResources && (
            <div className="border-t-2 border-[var(--pane-divider)] bg-secondary/20">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resource Usage · Weekly hours</div>
              <div className="relative h-32">
                <div className="absolute inset-0 flex">
                  <div className="w-[480px] flex-shrink-0 border-r border-[var(--pane-divider)] flex flex-col justify-center px-3 text-xs gap-1">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-500" /> Mason (Skilled)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-500" /> Mazdoor (Unskilled)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-amber-500" /> Mixer Operator</div>
                  </div>
                  <div className="flex-1 relative">
                    {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                      const mason = 30 + 25 * Math.sin(i / 3)
                      const maz = 50 + 30 * Math.cos(i / 4)
                      const mx = 10 + 5 * Math.sin(i / 2)
                      const overAlloc = mason > 50 || maz > 80
                      return (
                        <div key={i} className="absolute bottom-0 group flex flex-col justify-end items-center" style={{ left: i * WEEK_WIDTH, width: WEEK_WIDTH }}>
                          <div className="w-full bg-blue-500/70 group-hover:bg-blue-500" style={{ height: `${mason}px` }} />
                          <div className="w-full bg-emerald-500/70 group-hover:bg-emerald-500" style={{ height: `${maz}px` }} />
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
