'use client'

import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-store'
import { List, LayoutGrid, PanelRight, ArrowLeft } from 'lucide-react'

// ─── 3-Pane (BOQ, Scheduler, Reports) ───────────────────────────────────────

interface Workspace3PaneProps {
  leftPane?: ReactNode
  centerPane: ReactNode
  rightPane?: ReactNode
  leftPaneWidth?: string
  rightPaneWidth?: string
  className?: string
}

export function Workspace3Pane({
  leftPane,
  centerPane,
  rightPane,
  leftPaneWidth = '280px',
  rightPaneWidth = '340px',
  className,
}: Workspace3PaneProps) {
  const [mobileTab, setMobileTab] = useState<'center' | 'left' | 'right'>('center')
  // Consume the persisted pane-toggle flags from the app store so the
  // header button and the `[` / `]` keyboard shortcuts actually do something.
  const { leftPaneOpen, rightPaneOpen } = useApp()
  const hasLeft = !!leftPane
  const hasRight = !!rightPane

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile tab bar */}
      {(hasLeft || hasRight) && (
        <div className="md:hidden flex items-center gap-1 p-2 border-b border-[var(--pane-divider)] pane flex-shrink-0">
          {hasLeft && (
            <button onClick={() => setMobileTab('left')}
              className={cn('flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors',
                mobileTab === 'left' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
              <List className="w-3.5 h-3.5" /><span>List</span>
            </button>
          )}
          <button onClick={() => setMobileTab('center')}
            className={cn('flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors flex-1',
              mobileTab === 'center' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
            <LayoutGrid className="w-3.5 h-3.5" /><span>Canvas</span>
          </button>
          {hasRight && (
            <button onClick={() => setMobileTab('right')}
              className={cn('flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors',
                mobileTab === 'right' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
              <PanelRight className="w-3.5 h-3.5" /><span>Detail</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile layout */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        {hasLeft && mobileTab === 'left' && <div className="h-full overflow-hidden pane flex flex-col">{leftPane}</div>}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'center' && 'hidden')}>{centerPane}</div>
        {hasRight && mobileTab === 'right' && <div className="h-full overflow-hidden pane flex flex-col">{rightPane}</div>}
      </div>

      {/* Desktop layout — panes respect the persisted open/close flags. */}
      <div className="hidden md:flex h-full overflow-hidden">
        {leftPane && leftPaneOpen && (
          <div className="flex-shrink-0 border-r border-[var(--pane-divider)] pane flex flex-col min-w-0" style={{ width: leftPaneWidth }}>{leftPane}</div>
        )}
        <div className="flex-1 min-w-0 flex flex-col pane">{centerPane}</div>
        {rightPane && rightPaneOpen && (
          <div className="flex-shrink-0 border-l border-[var(--pane-divider)] pane flex flex-col min-w-0" style={{ width: rightPaneWidth }}>{rightPane}</div>
        )}
      </div>
    </div>
  )
}

// ─── 2-Pane (most modules: list + detail) ────────────────────────────────────

interface Workspace2PaneProps {
  /** Alternative: accept 3-pane props for backwards compat — leftPane becomes listPane, centerPane+rightPane merge into detailPane */
  leftPane?: ReactNode
  centerPane?: ReactNode
  rightPane?: ReactNode
  /** Direct 2-pane props */
  listPane?: ReactNode
  detailPane?: ReactNode
  listPaneWidth?: string
  leftPaneWidth?: string
  rightPaneWidth?: string
  className?: string
}

export function Workspace2Pane({
  // 3-pane compat props
  leftPane,
  centerPane,
  rightPane,
  // 2-pane direct props
  listPane,
  detailPane,
  listPaneWidth = '300px',
  leftPaneWidth,
  rightPaneWidth,
  className,
}: Workspace2PaneProps) {
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list')
  const { leftPaneOpen } = useApp()

  // Resolve: if listPane/detailPane are provided directly, use them
  // Otherwise, leftPane = list, centerPane + rightPane = detail (3-pane compat)
  const resolvedList = listPane || leftPane
  const resolvedDetail = detailPane || (
    <>
      {centerPane}
      {rightPane}
    </>
  )
  const resolvedListWidth = leftPaneWidth || listPaneWidth

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile tab bar */}
      <div className="md:hidden flex items-center gap-1 p-2 border-b border-[var(--pane-divider)] pane flex-shrink-0">
        <button onClick={() => setMobileTab('list')}
          className={cn('flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors flex-1',
            mobileTab === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
          <List className="w-3.5 h-3.5" /><span>List</span>
        </button>
        <button onClick={() => setMobileTab('detail')}
          className={cn('flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors flex-1',
            mobileTab === 'detail' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
          <PanelRight className="w-3.5 h-3.5" /><span>Detail</span>
        </button>
      </div>

      {/* Mobile layout */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'list' && 'hidden')}>{resolvedList}</div>
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'detail' && 'hidden')}>
          <button onClick={() => setMobileTab('list')}
            className="md:hidden flex items-center gap-1.5 h-9 px-3 border-b border-[var(--pane-divider)] text-xs text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to list
          </button>
          {resolvedDetail}
        </div>
      </div>

      {/* Desktop layout — list pane respects the persisted leftPaneOpen flag. */}
      <div className="hidden md:flex h-full overflow-hidden">
        {resolvedList && leftPaneOpen && (
          <div className="flex-shrink-0 border-r border-[var(--pane-divider)] pane flex flex-col min-w-0" style={{ width: resolvedListWidth }}>{resolvedList}</div>
        )}
        <div className="flex-1 min-w-0 flex flex-col pane">{resolvedDetail}</div>
      </div>
    </div>
  )
}

// ─── 1-Pane (Dashboard) ──────────────────────────────────────────────────────

interface Workspace1PaneProps {
  children: ReactNode
  className?: string
}

export function Workspace1Pane({ children, className }: Workspace1PaneProps) {
  return (
    <div className={cn('h-full w-full overflow-hidden pane flex flex-col', className)}>
      {children}
    </div>
  )
}

// ─── Shared Pane components ──────────────────────────────────────────────────

export function PaneHeader({
  title,
  children,
  className,
}: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('h-10 flex-shrink-0 flex items-center gap-2 px-3 border-b border-[var(--pane-divider)] vibrancy', className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{title}</div>
      <div className="flex-1" />
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">{children}</div>
    </div>
  )
}

export function PaneBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 min-h-0 overflow-y-auto', className)}>
      {children}
    </div>
  )
}
