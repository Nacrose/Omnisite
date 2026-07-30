'use client'

import { ModuleId, MODULES, useApp } from '@/lib/app-store'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { QuickAddMenu } from '@/components/quick-add-menu'
import { CommandPalette } from '@/components/command-palette'
import { NotificationsBell } from '@/components/notifications-bell'
import { ProjectSwitcher } from '@/components/project-switcher'
import { StatusBar } from '@/components/status-bar'
import { HelpModal } from '@/components/help-modal'
import { DockNav } from '@/components/dock-nav'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronDown, PanelRight, Building2,
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

export default function Home() {
  const { activeModule, rightPaneOpen, toggleRightPane, setCommandOpen } = useApp()
  const active = MODULES.find(m => m.id === activeModule)!
  const Renderer = MODULE_RENDERERS[activeModule]
  useKeyboardShortcuts()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden workspace-bg theme-transition">
      {/* Top bar — responsive */}
      <header className="h-14 flex-shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 border-b border-[var(--pane-divider)] vibrancy">
        {/* Brand — smaller on mobile */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] flex items-center justify-center shadow-sm">
            <Building2 className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col leading-tight hidden sm:block">
            <span className="text-sm sm:text-[15px] font-bold tracking-tight">OmniSite</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden md:block">Construction Cloud</span>
          </div>
        </div>

        <div className="w-px h-8 bg-[var(--pane-divider)] mx-0.5 hidden sm:block" />

        {/* Breadcrumb — module name only on mobile, full on desktop */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <span className="text-sm font-semibold truncate">{active.shortName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          <span className="text-sm text-muted-foreground hidden md:inline">·</span>
          <div className="hidden md:block">
            <ProjectSwitcher />
          </div>
        </div>

        <div className="flex-1 hidden sm:block" />

        {/* Right controls — simplified on mobile */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Search — icon only on mobile */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground text-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline ml-1.5">Search…</span>
            <kbd className="ml-1 text-[10px] px-1 py-0.5 rounded bg-background border border-border font-mono hidden md:inline">⌘K</kbd>
          </button>

          <NotificationsBell />
          <ThemeSwitcher />

          <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

          {/* User — avatar only on mobile */}
          <button className="flex items-center gap-2 h-8 px-1.5 rounded-md hover:bg-accent">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              AS
            </div>
            <div className="text-left leading-tight hidden lg:block">
              <div className="text-xs font-medium">Arjun Sharma</div>
              <div className="text-[10px] text-muted-foreground">Project Manager</div>
            </div>
          </button>

          {/* Inspector toggle — desktop only */}
          <button
            onClick={toggleRightPane}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hidden md:block"
            title="Toggle inspector"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Module viewport — now full width */}
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

      {/* Bottom status bar — desktop only */}
      <div className="hidden md:block">
        <StatusBar />
      </div>

      {/* macOS-style dock with auto-hide */}
      <DockNav />

      {/* Overlays */}
      <QuickAddMenu />
      <CommandPalette />
      <HelpModal />
    </div>
  )
}
