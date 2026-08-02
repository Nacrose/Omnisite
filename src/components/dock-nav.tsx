'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { MODULES, useApp, ModuleId } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { cn } from '@/lib/utils'
import { Building2, Search, Plus } from 'lucide-react'

const MODULE_GROUPS = [
  'Overview',
  'Pre-Construction',
  'Site Execution',
  'Project Controls',
  'Documents',
  'Resources',
]

interface DockItem {
  id: ModuleId
  name: string
  shortName: string
  icon: string
  group: string
}

export function DockNav() {
  const { activeModule, setCommandOpen, setQuickAddOpen } = useApp()
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(true)

  // Navigate to the module's URL route. The layout's URL→store sync will
  // update activeModule when the route changes.
  const navigateToModule = (id: ModuleId) => router.push(`/${id}`)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  // Auto-hide only on desktop (md+). On mobile, dock is always visible.
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile) {
      // Dock is already visible by default state on mobile
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      const triggerZone = window.innerHeight - 80
      if (e.clientY > triggerZone) {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        setIsVisible(true)
      } else if (e.clientY < window.innerHeight - 120) {
        if (!hideTimerRef.current) {
          hideTimerRef.current = setTimeout(() => setIsVisible(false), 1500)
        }
      }
    }

    const dock = dockRef.current
    const onDockEnter = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
      setIsVisible(true)
    }
    if (dock) dock.addEventListener('mouseenter', onDockEnter)

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (dock) dock.removeEventListener('mouseenter', onDockEnter)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Group modules by their group
  const grouped = MODULE_GROUPS.map((group) => ({
    group,
    items: MODULES.filter((m) => m.group === group),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      {/* ─── Mobile dock: fixed bottom bar, always visible, no animation ─── */}
      <div className="pane fixed right-0 bottom-0 left-0 z-50 border-t border-[var(--pane-divider)] md:hidden">
        <div
          className="flex items-center justify-around px-2 py-1.5"
          style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        >
          {grouped.map((g) =>
            g.items.map((item) => (
              <MobileDockIcon
                key={item.id}
                item={item}
                isActive={activeModule === item.id}
                onClick={() => navigateToModule(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── Desktop dock: auto-hide with magnification ─── */}
      {/* Invisible hover trigger zone — desktop only */}
      <div
        className="fixed right-0 bottom-0 left-0 z-40 hidden h-20 md:block"
        onMouseEnter={() => setIsVisible(true)}
      />

      {/* The dock — desktop only */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={dockRef}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.5 }}
            className="fixed bottom-6 left-1/2 z-50 hidden max-w-[calc(100vw-1rem)] -translate-x-1/2 md:flex"
            onMouseLeave={() => {
              const isMobile = window.matchMedia('(max-width: 767px)').matches
              if (!isMobile) {
                hideTimerRef.current = setTimeout(() => setIsVisible(false), 1500)
              }
            }}
          >
            <div
              className="pane vibrancy dock-scroll flex items-end gap-1 overflow-x-auto rounded-2xl border border-[var(--pane-divider)] px-2 py-2 shadow-2xl"
              style={{ backdropFilter: 'saturate(180%) blur(30px)' }}
            >
              {/* Brand — hidden on mobile to save space */}
              <div className="mr-1 hidden flex-shrink-0 items-center gap-2 border-r border-[var(--pane-divider)] px-3 py-1 md:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] shadow-sm">
                  <Building2 className="h-4 w-4 text-white" strokeWidth={2.2} />
                </div>
              </div>

              {/* Quick action buttons — hidden on mobile */}
              <div className="hidden flex-shrink-0 items-end gap-1 md:flex">
                <DockActionButton
                  icon={Search}
                  label="Search (⌘K)"
                  onClick={() => setCommandOpen(true)}
                />
                <DockActionButton
                  icon={Plus}
                  label="Quick Add (N)"
                  onClick={() => setQuickAddOpen(true)}
                  highlight
                />
              </div>

              {/* Divider — hidden on mobile */}
              <div className="mx-1 hidden h-10 w-px flex-shrink-0 bg-[var(--pane-divider)] md:block" />

              {/* Module groups with dividers between groups */}
              {grouped.map((g, gi) => (
                <div key={g.group} className="flex flex-shrink-0 items-end gap-0.5">
                  {gi > 0 && (
                    <div className="mx-0.5 hidden h-8 w-px bg-[var(--pane-divider)] md:block" />
                  )}
                  {g.items.map((item) => (
                    <DockIcon
                      key={item.id}
                      item={item}
                      isActive={activeModule === item.id}
                      onClick={() => navigateToModule(item.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Individual dock icon with magnification ─────────────────────────────────

function DockIcon({
  item,
  isActive,
  onClick,
}: {
  item: DockItem
  isActive: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const mouseX = useMotionValue(Infinity)
  const [hovered, setHovered] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    tooltipTimerRef.current = setTimeout(() => setHovered(true), 200)
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      mouseX.set(e.clientX - (rect.left + rect.width / 2))
    }
  }

  const handleMouseLeave = () => {
    mouseX.set(Infinity)
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
    setHovered(false)
  }

  // Magnification: icon grows based on proximity to cursor (macOS dock effect)
  // On mobile (no mouse), icons stay fixed at 40px
  const distance = useTransform(mouseX, (val) => Math.abs(val))
  const sizeT = useTransform(distance, [0, 80], [52, 36])
  const size = useSpring(sizeT, { stiffness: 500, damping: 30, mass: 0.3 })

  return (
    <>
      {/* Desktop: magnifying dock icon */}
      <motion.button
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        style={{ width: size, height: size }}
        className={cn(
          'relative hidden flex-shrink-0 flex-col items-center justify-end rounded-xl transition-colors md:flex',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary/40 hover:bg-accent text-foreground'
        )}
        title={item.name}
        aria-label={item.name}
        aria-current={isActive ? 'page' : undefined}
      >
        <motion.div
          style={{ width: size, height: size }}
          className="flex items-center justify-center"
        >
          <ModuleIcon name={item.icon} className="h-1/2 w-1/2" />
        </motion.div>
        {isActive && (
          <div className="bg-primary absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" />
        )}
        <DockLabel item={item} show={hovered} />
      </motion.button>

      {/* Mobile: fixed-size icon */}
      <button
        onClick={onClick}
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors md:hidden',
          isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-foreground'
        )}
        title={item.name}
        aria-label={item.name}
        aria-current={isActive ? 'page' : undefined}
      >
        <ModuleIcon name={item.icon} className="h-5 w-5" />
        {isActive && (
          <div className="bg-primary absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" />
        )}
      </button>
    </>
  )
}

// ─── Label tooltip that appears above the icon on hover ───────────────────────

function DockLabel({ item, show }: { item: DockItem; show: boolean }) {
  return (
    <div className="pointer-events-none absolute bottom-full mb-2">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="pane rounded-lg border border-[var(--pane-divider)] px-2.5 py-1 whitespace-nowrap shadow-lg"
          >
            <div className="text-[11px] font-medium">{item.name}</div>
            <div className="text-muted-foreground text-[9px]">{item.group}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Quick action button (Search, Quick Add) ─────────────────────────────────

function DockActionButton({
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  icon: typeof Search
  label: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
        highlight
          ? 'bg-primary text-primary-foreground hover:opacity-90'
          : 'bg-secondary/40 hover:bg-accent text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

// ─── Mobile dock icon — compact, always visible ──────────────────────────────

function MobileDockIcon({
  item,
  isActive,
  onClick,
}: {
  item: DockItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
          isActive ? 'bg-primary/15' : ''
        )}
      >
        <ModuleIcon name={item.icon} className="h-4 w-4" />
      </div>
      <span className="w-full truncate text-center text-[8px] leading-tight font-medium">
        {item.shortName}
      </span>
    </button>
  )
}
