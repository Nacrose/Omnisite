'use client'

import { ReactNode, useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-store'
import { List, LayoutGrid, PanelRight, ArrowLeft, Lock, Unlock } from 'lucide-react'

// ─── Pane Resize Hook ───────────────────────────────────────────────────────

function usePaneResize(initialWidth: number, storageKey: string, min = 180, max = 600) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return initialWidth
    try {
      const stored = window.localStorage.getItem(`pane-width-${storageKey}`)
      return stored ? parseInt(stored, 10) : initialWidth
    } catch {
      return initialWidth
    }
  })
  const [locked, setLocked] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(`pane-width-${storageKey}`, String(width))
    } catch {
      /* ignore */
    }
  }, [width, storageKey])

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (locked) return
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { startX: e.clientX, startWidth: width }

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const delta = ev.clientX - dragRef.current.startX
        const newWidth = Math.max(min, Math.min(max, dragRef.current.startWidth + delta))
        setWidth(newWidth)
      }

      const onUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [locked, width, min, max]
  )

  return { width, locked, setLocked, startDrag }
}

// ─── PaneResizer component ──────────────────────────────────────────────────

function PaneResizer({
  onDragStart,
  locked,
  onToggleLock,
  side = 'right',
}: {
  onDragStart: (e: React.MouseEvent) => void
  locked: boolean
  onToggleLock: () => void
  side?: 'left' | 'right'
}) {
  return (
    <div className={cn('pane-resizer group/resizer', locked && 'locked')} onMouseDown={onDragStart}>
      {/* Lock button — appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggleLock()
        }}
        className={cn(
          'pane absolute top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-[var(--pane-divider)] shadow-sm transition-opacity',
          side === 'left' ? '-right-2.5' : '-left-2.5',
          'opacity-0 group-hover/resizer:opacity-100'
        )}
        title={locked ? 'Unlock pane width' : 'Lock pane width'}
      >
        {locked ? (
          <Lock className="text-muted-foreground h-2.5 w-2.5" />
        ) : (
          <Unlock className="text-muted-foreground h-2.5 w-2.5" />
        )}
      </button>
    </div>
  )
}

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

  const leftResize = usePaneResize(parseInt(leftPaneWidth), '3pane-left', 180, 500)
  const rightResize = usePaneResize(parseInt(rightPaneWidth), '3pane-right', 200, 600)

  return (
    <div className={cn('flex h-full w-full flex-col overflow-hidden', className)}>
      {/* Mobile: floating bottom segmented control */}
      {(hasLeft || hasRight) && (
        <div className="pane fixed bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[var(--pane-divider)] p-0.5 shadow-lg md:hidden">
          {hasLeft && (
            <button
              onClick={() => setMobileTab('left')}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                mobileTab === 'left'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setMobileTab('center')}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              mobileTab === 'center'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          {hasRight && (
            <button
              onClick={() => setMobileTab('right')}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                mobileTab === 'right'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Mobile layout */}
      <div className="min-h-0 flex-1 overflow-hidden md:hidden">
        {hasLeft && mobileTab === 'left' && (
          <div className="pane flex h-full flex-col overflow-hidden">{leftPane}</div>
        )}
        <div
          className={cn(
            'pane flex h-full flex-col overflow-hidden',
            mobileTab !== 'center' && 'hidden'
          )}
        >
          {centerPane}
        </div>
        {hasRight && mobileTab === 'right' && (
          <div className="pane flex h-full flex-col overflow-hidden">{rightPane}</div>
        )}
      </div>

      {/* Desktop layout — resizable + lockable panes */}
      <div className="hidden h-full overflow-hidden md:flex">
        {leftPane && leftPaneOpen && (
          <>
            <div
              className="pane flex min-w-0 flex-shrink-0 flex-col overflow-hidden border-r border-[var(--pane-divider)]"
              style={{ width: `${leftResize.width}px` }}
            >
              {leftPane}
            </div>
            <PaneResizer
              onDragStart={leftResize.startDrag}
              locked={leftResize.locked}
              onToggleLock={() => leftResize.setLocked((l) => !l)}
              side="left"
            />
          </>
        )}
        <div className="pane flex min-w-0 flex-1 flex-col">{centerPane}</div>
        {rightPane && rightPaneOpen && (
          <>
            <PaneResizer
              onDragStart={rightResize.startDrag}
              locked={rightResize.locked}
              onToggleLock={() => rightResize.setLocked((l) => !l)}
              side="right"
            />
            <div
              className="pane flex min-w-0 flex-shrink-0 flex-col overflow-hidden border-l border-[var(--pane-divider)]"
              style={{ width: `${rightResize.width}px` }}
            >
              {rightPane}
            </div>
          </>
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

  const listResize = usePaneResize(parseInt(resolvedListWidth), '2pane-list', 180, 500)

  return (
    <div className={cn('flex h-full w-full flex-col overflow-hidden', className)}>
      {/* Mobile: push navigation */}
      <div className="min-h-0 flex-1 overflow-hidden md:hidden">
        <div
          className={cn(
            'pane flex h-full flex-col overflow-hidden',
            mobileView !== 'list' && 'hidden'
          )}
        >
          {resolvedList}
        </div>
        <div
          className={cn(
            'pane flex h-full flex-col overflow-hidden',
            mobileView !== 'detail' && 'hidden'
          )}
        >
          {resolvedDetail && (
            <button
              onClick={() => setMobileView('list')}
              className="text-primary flex h-9 flex-shrink-0 items-center gap-1.5 border-b border-[var(--pane-divider)] px-3 text-xs md:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          {resolvedDetail}
        </div>
      </div>

      {/* Desktop layout — resizable + lockable list pane */}
      <div className="hidden h-full overflow-hidden md:flex">
        {resolvedList && leftPaneOpen && (
          <>
            <div
              className="pane flex min-w-0 flex-shrink-0 flex-col overflow-hidden border-r border-[var(--pane-divider)]"
              style={{ width: `${listResize.width}px` }}
            >
              {resolvedList}
            </div>
            <PaneResizer
              onDragStart={listResize.startDrag}
              locked={listResize.locked}
              onToggleLock={() => listResize.setLocked((l) => !l)}
              side="left"
            />
          </>
        )}
        <div className="pane flex min-w-0 flex-1 flex-col">{resolvedDetail}</div>
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
    <div className={cn('pane flex h-full w-full flex-col overflow-hidden', className)}>
      {children}
    </div>
  )
}

// ─── Shared Pane components ──────────────────────────────────────────────────

export function PaneHeader({
  title,
  children,
  className,
}: {
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'vibrancy flex h-10 flex-shrink-0 items-center gap-2 border-b border-[var(--pane-divider)] px-3',
        className
      )}
    >
      <div className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
        {title}
      </div>
      <div className="flex-1" />
      <div className="scrollbar-none flex max-w-[60%] items-center gap-1 overflow-x-auto md:max-w-none">
        {children}
      </div>
    </div>
  )
}

export function PaneBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>
}
