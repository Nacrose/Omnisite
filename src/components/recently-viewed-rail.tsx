'use client'

import { useApp, MODULES } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Recently Viewed rail — shows the last 5 modules the user visited,
 * as small icon-only chips at the top of the sidebar (below the brand).
 */
export function RecentlyViewedRail() {
  const { recentModules, activeModule, setActiveModule } = useApp()

  if (recentModules.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
      <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        <Clock className="w-2.5 h-2.5" />
        Recent
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <AnimatePresence>
          {recentModules.map((modId, i) => {
            const mod = MODULES.find(m => m.id === modId)
            if (!mod) return null
            const isActive = modId === activeModule
            return (
              <motion.button
                key={modId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: i * 30, duration: 0.2 }}
                onClick={() => setActiveModule(modId)}
                title={mod.name}
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center transition-all hover:scale-110',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary/60 hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
              >
                <ModuleIcon name={mod.icon} className="w-3.5 h-3.5" />
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
