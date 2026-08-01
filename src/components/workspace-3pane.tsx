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
  const { leftPaneOpen, rightPaneOpen } = useApp()
  const hasLeft = !!leftPane
  const hasRight = !!rightPane

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile: bottom segmented control instead of top tab bar.
          Saves vertical space, always reachable by thumb. */}
      {(hasLeft || hasRight) && (
        <div className="md:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 pane border border-[var(--pane-divider)] rounded-full shadow-lg p-0.5">
          {hasLeft && (
            <button onClick={() => setMobileTab('left')}
              className={cn('flex items-center justify-center w-9 h-9 rounded-full transition-colors',
                mobileTab === 'left' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <List className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setMobileTab('center')}
            className={cn('flex items-center justify-center w-9 h-9 rounded-full transition-colors',
              mobileTab === 'center' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          {hasRight && (
            <button onClick={() => setMobileTab('right')}
              className={cn('flex items-center justify-center w-9 h-9 rounded-full transition-colors',
                mobileTab === 'right' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <PanelRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Mobile layout — single full-screen panel */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        {hasLeft && mobileTab === 'left' && <div className="h-full overflow-hidden pane flex flex-col">{leftPane}</div>}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'center' && 'hidden')}>{centerPane}</div>
        {hasRight && mobileTab === 'right' && <div className="h-full overflow-hidden pane flex flex-col">{rightPane}</div>}
      </div>

      {/* Desktop layout */}
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
  leftPane?: ReactNode
  centerPane?: ReactNode
  rightPane?: ReactNode
  listPane?: ReactNode
  detailPane?: ReactNode
  listPaneWidth?: string
  leftPaneWidth?: string
  rightPaneWidth?: string
  className?: string
}

export function Workspace2Pane({
  leftPane,
  centerPane,
  rightPane,
  listPane,
  detailPane,
  listPaneWidth = '300px',
  leftPaneWidth,
  rightPaneWidth,
  className,
}: Workspace2PaneProps) {
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const { leftPaneOpen } = useApp()

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
      {/* Mobile: list→detail navigation with back button.
          No tab bar — the list takes the full screen, tapping an item
          pushes to the detail view with a back button at the top. */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        {/* List view */}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileView !== 'list' && 'hidden')}>
          {resolvedList}
        </div>
        {/* Detail view with back button */}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileView !== 'detail' && 'hidden')}>
          {resolvedDetail && (
            <button onClick={() => setMobileView('list')}
              className="md:hidden flex items-center gap-1.5 h-9 px-3 border-b border-[var(--pane-divider)] text-xs text-primary flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          {resolvedDetail}
        </div>
      </div>

      {/* Desktop layout */}
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
      {/* On mobile, action buttons scroll horizontally instead of wrapping */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-[60%] md:max-w-none">{children}</div>
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
