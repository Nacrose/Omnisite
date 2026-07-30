'use client'

import { ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { List, LayoutGrid, PanelRight } from 'lucide-react'

interface Workspace3PaneProps {
  leftPane?: ReactNode
  centerPane: ReactNode
  rightPane?: ReactNode
  leftPaneWidth?: string
  rightPaneWidth?: string
  leftPaneTitle?: string
  rightPaneTitle?: string
  className?: string
}

/**
 * The signature OmniSite 3-pane workspace:
 * Desktop: Left (Outline) | Center (Canvas) | Right (Inspector) side-by-side
 * Mobile: Segmented tab bar switches between one pane at a time
 */
export function Workspace3Pane({
  leftPane,
  centerPane,
  rightPane,
  leftPaneWidth = '280px',
  rightPaneWidth = '340px',
  className,
}: Workspace3PaneProps) {
  const [mobileTab, setMobileTab] = useState<'center' | 'left' | 'right'>('center')

  const hasLeft = !!leftPane
  const hasRight = !!rightPane

  return (
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile tab bar — only visible on small screens */}
      {(hasLeft || hasRight) && (
        <div className="md:hidden flex items-center gap-1 p-2 border-b border-[var(--pane-divider)] pane flex-shrink-0">
          {hasLeft && (
            <button
              onClick={() => setMobileTab('left')}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors',
                mobileTab === 'left' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          )}
          <button
            onClick={() => setMobileTab('center')}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors flex-1',
              mobileTab === 'center' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Canvas</span>
          </button>
          {hasRight && (
            <button
              onClick={() => setMobileTab('right')}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors',
                mobileTab === 'right' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              )}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span>Detail</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile layout — show only active pane */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        {hasLeft && mobileTab === 'left' && (
          <div className="h-full overflow-hidden pane flex flex-col">{leftPane}</div>
        )}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'center' && 'hidden')}>
          {centerPane}
        </div>
        {hasRight && mobileTab === 'right' && (
          <div className="h-full overflow-hidden pane flex flex-col">{rightPane}</div>
        )}
      </div>

      {/* Desktop layout — all 3 panes side-by-side */}
      <div className="hidden md:flex h-full overflow-hidden">
        {leftPane && (
          <div
            className="flex-shrink-0 border-r border-[var(--pane-divider)] pane flex flex-col min-w-0"
            style={{ width: leftPaneWidth }}
          >
            {leftPane}
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col pane">
          {centerPane}
        </div>
        {rightPane && (
          <div
            className="flex-shrink-0 border-l border-[var(--pane-divider)] pane flex flex-col min-w-0"
            style={{ width: rightPaneWidth }}
          >
            {rightPane}
          </div>
        )}
      </div>
    </div>
  )
}

export function PaneHeader({
  title,
  children,
  className,
}: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('h-10 flex-shrink-0 flex items-center gap-2 px-3 border-b border-[var(--pane-divider)] vibrancy', className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{title}</div>
      <div className="flex-1" />
      {/* On mobile, wrap action buttons to allow scrolling */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {children}
      </div>
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
