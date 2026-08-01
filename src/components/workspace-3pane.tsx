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
    } catch { return initialWidth }
  })
  const [locked, setLocked] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(`pane-width-${storageKey}`, String(width))
    } catch { /* ignore */ }
  }, [width, storageKey])

  const startDrag = useCallback((e: React.MouseEvent) => {
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
  }, [locked, width, min, max])

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
    <div
      className={cn('pane-resizer group/resizer', locked && 'locked')}
      onMouseDown={onDragStart}
    >
      {/* Lock button — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleLock() }}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded pane border border-[var(--pane-divider)] shadow-sm flex items-center justify-center transition-opacity',
          side === 'left' ? '-right-2.5' : '-left-2.5',
          'opacity-0 group-hover/resizer:opacity-100',
        )}
        title={locked ? 'Unlock pane width' : 'Lock pane width'}
      >
        {locked
          ? <Lock className="w-2.5 h-2.5 text-muted-foreground" />
          : <Unlock className="w-2.5 h-2.5 text-muted-foreground" />}
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
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile: floating bottom segmented control */}
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

      {/* Mobile layout */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        {hasLeft && mobileTab === 'left' && <div className="h-full overflow-hidden pane flex flex-col">{leftPane}</div>}
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileTab !== 'center' && 'hidden')}>{centerPane}</div>
        {hasRight && mobileTab === 'right' && <div className="h-full overflow-hidden pane flex flex-col">{rightPane}</div>}
      </div>

      {/* Desktop layout — resizable + lockable panes */}
      <div className="hidden md:flex h-full overflow-hidden">
        {leftPane && leftPaneOpen && (
          <>
            <div className="flex-shrink-0 border-r border-[var(--pane-divider)] pane flex flex-col min-w-0 overflow-hidden" style={{ width: `${leftResize.width}px` }}>{leftPane}</div>
            <PaneResizer
              onDragStart={leftResize.startDrag}
              locked={leftResize.locked}
              onToggleLock={() => leftResize.setLocked(l => !l)}
              side="left"
            />
          </>
        )}
        <div className="flex-1 min-w-0 flex flex-col pane">{centerPane}</div>
        {rightPane && rightPaneOpen && (
          <>
            <PaneResizer
              onDragStart={rightResize.startDrag}
              locked={rightResize.locked}
              onToggleLock={() => rightResize.setLocked(l => !l)}
              side="right"
            />
            <div className="flex-shrink-0 border-l border-[var(--pane-divider)] pane flex flex-col min-w-0 overflow-hidden" style={{ width: `${rightResize.width}px` }}>{rightPane}</div>
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
    <div className={cn('flex flex-col h-full w-full overflow-hidden', className)}>
      {/* Mobile: push navigation */}
      <div className="flex-1 min-h-0 md:hidden overflow-hidden">
        <div className={cn('h-full overflow-hidden pane flex flex-col', mobileView !== 'list' && 'hidden')}>
          {resolvedList}
        </div>
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

      {/* Desktop layout — resizable + lockable list pane */}
      <div className="hidden md:flex h-full overflow-hidden">
        {resolvedList && leftPaneOpen && (
          <>
            <div className="flex-shrink-0 border-r border-[var(--pane-divider)] pane flex flex-col min-w-0 overflow-hidden" style={{ width: `${listResize.width}px` }}>{resolvedList}</div>
            <PaneResizer
              onDragStart={listResize.startDrag}
              locked={listResize.locked}
              onToggleLock={() => listResize.setLocked(l => !l)}
              side="left"
            />
          </>
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
