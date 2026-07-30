'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
 * Left: Outline/List | Center: Canvas/Grid | Right: Contextual Inspector
 */
export function Workspace3Pane({
  leftPane,
  centerPane,
  rightPane,
  leftPaneWidth = '280px',
  rightPaneWidth = '340px',
  className,
}: Workspace3PaneProps) {
  return (
    <div className={cn('flex h-full w-full overflow-hidden', className)}>
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
      {children}
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
