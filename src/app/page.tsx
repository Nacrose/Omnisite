'use client'

import { ModuleId, MODULES, useApp } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { QuickAddMenu } from '@/components/quick-add-menu'
import { CommandPalette } from '@/components/command-palette'
import { NotificationsBell } from '@/components/notifications-bell'
import { ProjectSwitcher } from '@/components/project-switcher'
import { StatusBar } from '@/components/status-bar'
import { RecentlyViewedRail } from '@/components/recently-viewed-rail'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, ChevronDown, PanelLeft, PanelRight,
  Building2, CircleUser, Wifi,
} from 'lucide-react'
import { DashboardModule } from '@/components/modules/dashboard'
import { BoqModule } from '@/components/modules/boq'
import { SchedulerModule } from '@/components/modules/scheduler'
import { DailyOpsModule } from '@/components/modules/daily-ops'
import { EquipmentModule } from '@/components/modules/equipment'
import { ProcurementModule } from '@/components/modules/procurement'
import { FinancialsModule } from '@/components/modules/financials'
import { SubcontractorModule } from '@/components/modules/subcontractor'
import { DrawingsModule } from '@/components/modules/drawings'
import { CorrespondenceModule } from '@/components/modules/correspondence'
import { AdminModule } from '@/components/modules/admin'
import { ReportsModule } from '@/components/modules/reports'
import { QsModule } from '@/components/modules/qs'
import { TimeAttendanceModule } from '@/components/modules/time-attendance'

const MODULE_RENDERERS: Record<ModuleId, () => React.ReactNode> = {
  dashboard: () => <DashboardModule />,
  boq: () => <BoqModule />,
  scheduler: () => <SchedulerModule />,
  'daily-ops': () => <DailyOpsModule />,
  equipment: () => <EquipmentModule />,
  procurement: () => <ProcurementModule />,
  financials: () => <FinancialsModule />,
  subcontractor: () => <SubcontractorModule />,
  drawings: () => <DrawingsModule />,
  correspondence: () => <CorrespondenceModule />,
  admin: () => <AdminModule />,
  reports: () => <ReportsModule />,
  qs: () => <QsModule />,
  'time-attendance': () => <TimeAttendanceModule />,
}

const MODULE_GROUPS = ['Overview', 'Pre-Construction', 'Site Execution', 'Project Controls', 'Documents', 'Resources']

export default function Home() {
  const { activeModule, setActiveModule, leftPaneOpen, rightPaneOpen, toggleLeftPane, toggleRightPane, setCommandOpen, setQuickAddOpen } = useApp()
  const active = MODULES.find(m => m.id === activeModule)!
  const Renderer = MODULE_RENDERERS[activeModule]
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen w-screen overflow-hidden workspace-bg theme-transition">
      {/* Sidebar Navigation Rail */}
      <aside className="w-[236px] flex-shrink-0 flex flex-col border-r border-[var(--pane-divider)] pane">
        {/* Brand */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[var(--pane-divider)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] flex items-center justify-center shadow-sm">
            <Building2 className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight">OmniSite</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Construction Cloud</span>
          </div>
        </div>

        {/* Recently viewed rail */}
        <RecentlyViewedRail />

        {/* Search trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground text-sm transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search…</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-mono">⌘K</kbd>
        </button>
        <div className="px-4 pt-1 pb-0.5 text-[9px] text-muted-foreground/50">
          Press a letter to jump: <kbd className="px-0.5 rounded bg-secondary font-mono">B</kbd> <kbd className="px-0.5 rounded bg-secondary font-mono">S</kbd> <kbd className="px-0.5 rounded bg-secondary font-mono">D</kbd> <kbd className="px-0.5 rounded bg-secondary font-mono">F</kbd> <kbd className="px-0.5 rounded bg-secondary font-mono">N</kbd>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {MODULE_GROUPS.map(group => {
            const items = MODULES.filter(m => m.group === group)
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-3">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </div>
                <div className="space-y-0.5 px-2">
                  {items.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setActiveModule(m.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-sm transition-all group',
                        activeModule === m.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <ModuleIcon name={m.icon} className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{m.shortName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Sync status */}
        <div className="px-4 py-2.5 border-t border-[var(--pane-divider)] flex items-center gap-2 text-xs text-muted-foreground">
          <div className="relative">
            <Wifi className="w-3.5 h-3.5" />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          </div>
          <span>Real-time sync · 4 collaborators</span>
        </div>
      </aside>

      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex-shrink-0 flex items-center gap-2 px-4 border-b border-[var(--pane-divider)] vibrancy">
          <button
            onClick={toggleLeftPane}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            title="Toggle outline"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold">{active.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">·</span>
            <ProjectSwitcher />
          </div>

          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium shadow-sm transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add</span>
            </button>

            <button
              onClick={() => setCommandOpen(true)}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>

            <NotificationsBell />

            <ThemeSwitcher />

            <div className="w-px h-6 bg-border mx-1" />

            <button className="flex items-center gap-2 h-8 px-1.5 rounded-md hover:bg-accent">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-xs font-semibold">
                AS
              </div>
              <div className="text-left leading-tight hidden lg:block">
                <div className="text-xs font-medium">Arjun Sharma</div>
                <div className="text-[10px] text-muted-foreground">Project Manager</div>
              </div>
            </button>

            <button
              onClick={toggleRightPane}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
              title="Toggle inspector"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Module viewport */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Renderer />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom status bar */}
        <StatusBar />
      </div>

      <QuickAddMenu />
      <CommandPalette />
    </div>
  )
}
