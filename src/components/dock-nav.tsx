'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { MODULES, useApp, ModuleId } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { cn } from '@/lib/utils'
import { Building2, Search, Plus } from 'lucide-react'

const MODULE_GROUPS = ['Overview', 'Pre-Construction', 'Site Execution', 'Project Controls', 'Documents', 'Resources']

interface DockItem {
  id: ModuleId
  name: string
  shortName: string
  icon: string
  group: string
}

export function DockNav() {
  const { activeModule, setActiveModule, setCommandOpen, setQuickAddOpen } = useApp()
  const [isVisible, setIsVisible] = useState(true)
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
    if (dock) {
      dock.addEventListener('mouseenter', () => {
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        setIsVisible(true)
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Group modules by their group
  const grouped = MODULE_GROUPS.map(group => ({
    group,
    items: MODULES.filter(m => m.group === group),
  })).filter(g => g.items.length > 0)

  return (
    <>
      {/* Invisible hover trigger zone — desktop only */}
      <div
        className="fixed bottom-0 left-0 right-0 h-20 z-40 hidden md:block"
        onMouseEnter={() => setIsVisible(true)}
      />

      {/* The dock */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={dockRef}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.5 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1rem)]"
            onMouseLeave={() => {
              const isMobile = window.matchMedia('(max-width: 767px)').matches
              if (!isMobile) {
                hideTimerRef.current = setTimeout(() => setIsVisible(false), 1500)
              }
            }}
          >
            <div className="flex items-end gap-1 px-2 py-2 rounded-2xl pane border border-[var(--pane-divider)] shadow-2xl vibrancy overflow-x-auto dock-scroll"
              style={{ backdropFilter: 'saturate(180%) blur(30px)' }}
            >
              {/* Brand — hidden on mobile to save space */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 mr-1 border-r border-[var(--pane-divider)] flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] flex items-center justify-center shadow-sm">
                  <Building2 className="w-4 h-4 text-white" strokeWidth={2.2} />
                </div>
              </div>

              {/* Quick action buttons — hidden on mobile */}
              <div className="hidden md:flex items-end gap-1 flex-shrink-0">
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
              <div className="hidden md:block w-px h-10 bg-[var(--pane-divider)] mx-1 flex-shrink-0" />

              {/* Module groups with dividers between groups */}
              {grouped.map((g, gi) => (
                <div key={g.group} className="flex items-end gap-0.5 flex-shrink-0">
                  {gi > 0 && <div className="hidden md:block w-px h-8 bg-[var(--pane-divider)] mx-0.5" />}
                  {g.items.map((item) => (
                    <DockIcon
                      key={item.id}
                      item={item}
                      isActive={activeModule === item.id}
                      onClick={() => setActiveModule(item.id)}
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

function DockIcon({ item, isActive, onClick }: {
  item: DockItem
  isActive: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const mouseX = useMotionValue(Infinity)

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      mouseX.set(e.clientX - (rect.left + rect.width / 2))
    }
  }

  const handleMouseLeave = () => {
    mouseX.set(Infinity)
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
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        style={{ width: size, height: size }}
        className={cn(
          'hidden md:flex relative flex-col items-center justify-end rounded-xl transition-colors flex-shrink-0',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary/40 hover:bg-accent text-foreground',
        )}
        title={item.name}
      >
        <motion.div style={{ width: size, height: size }} className="flex items-center justify-center">
          <ModuleIcon name={item.icon} className="w-1/2 h-1/2" />
        </motion.div>
        {isActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
        <DockLabel item={item} />
      </motion.button>

      {/* Mobile: fixed-size icon */}
      <button
        onClick={onClick}
        className={cn(
          'md:hidden w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary/40 text-foreground',
        )}
        title={item.name}
      >
        <ModuleIcon name={item.icon} className="w-5 h-5" />
        {isActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
      </button>
    </>
  )
}

// ─── Label tooltip that appears above the icon on hover ───────────────────────

function DockLabel({ item }: { item: DockItem }) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => setShow(true), 200)
  }
  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShow(false)
  }

  return (
    <div
      className="absolute bottom-full mb-2 pointer-events-none"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="px-2.5 py-1 rounded-lg pane border border-[var(--pane-divider)] shadow-lg whitespace-nowrap"
          >
            <div className="text-[11px] font-medium">{item.name}</div>
            <div className="text-[9px] text-muted-foreground">{item.group}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Quick action button (Search, Quick Add) ─────────────────────────────────

function DockActionButton({ icon: Icon, label, onClick, highlight }: {
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
        'w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0',
        highlight
          ? 'bg-primary text-primary-foreground hover:opacity-90'
          : 'bg-secondary/40 hover:bg-accent text-foreground',
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
