'use client'

import { ChevronRight, ChevronDown, Flag, Layers, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from './types'

interface SchedulerOutlineProps {
  /** Filtered task tree (already trimmed by search + critical-only). */
  filteredTasks: Task[]
  /** Set of expanded task IDs. */
  expanded: Set<string>
  /** Currently selected task ID (highlighted). */
  selectedId: string
  /** Whether "critical path only" filter is active. */
  showCriticalOnly: boolean
  /** Callback when a row is clicked. */
  onSelect: (id: string) => void
  /** Callback when the expand/collapse chevron is clicked. */
  onToggleExpand: (id: string) => void
}

/**
 * Task outline (left pane of the Scheduler).
 *
 * Renders the task tree as a flat list of indented rows. Each row shows:
 *   [expand-chevron] [id] [type-icon] [name] [duration] [progress%]
 *
 * "Critical path only" filter: skips non-critical LEAF tasks. Summary tasks
 * are always rendered (they provide structure) — UNLESS they have no critical
 * descendants, in which case they're empty shells that just add noise (S7-5).
 *
 * Extracted from `SchedulerModule` so the component body focuses on layout.
 */
export function SchedulerOutline({
  filteredTasks,
  expanded,
  selectedId,
  showCriticalOnly,
  onSelect,
  onToggleExpand,
}: SchedulerOutlineProps) {
  const rows: React.ReactNode[] = []
  const walk = (items: Task[], depth: number) => {
    for (const t of items) {
      // "Critical path only" filter: skip non-critical LEAF tasks.
      const isLeaf = !t.children || t.children.length === 0
      if (showCriticalOnly && isLeaf && !t.critical) continue
      // For Summary tasks in critical-only mode, check if any descendant is
      // critical. If not, skip the Summary entirely.
      if (showCriticalOnly && !isLeaf && !t.critical) {
        const hasCriticalDescendant = (nodes: Task[] | undefined): boolean =>
          nodes?.some((n) => n.critical || hasCriticalDescendant(n.children)) ?? false
        if (!hasCriticalDescendant(t.children)) continue
      }

      const isExpanded = expanded.has(t.id)
      const hasChildren = t.children && t.children.length > 0
      const isSelected = t.id === selectedId
      rows.push(
        <div
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            'row-hover flex h-8 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
            isSelected && 'bg-accent',
            t.critical && 'bg-red-500/5'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="w-6 flex-shrink-0">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(t.id)
                }}
                className="hover:bg-accent-foreground/10 rounded p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="text-muted-foreground w-20 flex-shrink-0 font-mono">{t.id}</div>
          <div className="w-5 flex-shrink-0">
            {t.type === 'Milestone' && <Flag className="h-3.5 w-3.5 text-amber-500" />}
            {t.type === 'Hammock' && <Zap className="h-3.5 w-3.5 text-violet-500" />}
            {t.type === 'Summary' && <Layers className="text-muted-foreground h-3.5 w-3.5" />}
          </div>
          <div className={cn('min-w-0 flex-1 truncate', t.type === 'Summary' && 'font-semibold')}>
            {t.name}
          </div>
          <div className="w-16 flex-shrink-0 pr-2 text-right">
            {/* Duration is in WEEKS (matches types.ts `start: week offset`). */}
            <span className="font-mono tabular-nums">{t.duration}w</span>
            {t.baseline && t.baseline[1] - t.baseline[0] !== t.duration && t.type !== 'Summary' && (
              <span className="text-muted-foreground ml-1 text-[9px] line-through">
                {t.baseline[1] - t.baseline[0]}w
              </span>
            )}
          </div>
          <div className="w-14 flex-shrink-0 pr-2 text-right font-mono">{t.progress}%</div>
        </div>
      )
      if (hasChildren && isExpanded) walk(t.children!, depth + 1)
    }
  }
  walk(filteredTasks, 0)
  return <>{rows}</>
}
