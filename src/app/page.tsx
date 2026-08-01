'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ModuleId, MODULES, useApp } from '@/lib/app-store'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { QuickAddMenu } from '@/components/quick-add-menu'
import { CommandPalette } from '@/components/command-palette'
import { NotificationsBell } from '@/components/notifications-bell'
import { ProjectSwitcher } from '@/components/project-switcher'
import { StatusBar } from '@/components/status-bar'
import { HelpModal } from '@/components/help-modal'
import { DockNav } from '@/components/dock-nav'
import { ErrorBoundary } from '@/components/error-boundary'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'
import { useAuth } from '@/lib/auth'
import { ROLE_TEMPLATES } from '@/lib/permissions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronDown, PanelRight, Building2, Loader2, LogOut, Plus,
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
import { ChatModule } from '@/components/modules/chat'

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
  chat: () => <ChatModule />,
}

export default function Home() {
  const { activeModule, toggleRightPane, setCommandOpen, setQuickAddOpen } = useApp()
  const { user, loading, signOut, isDemo } = useAuth()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const active = MODULES.find(m => m.id === activeModule) ?? MODULES[0]
  const Renderer = MODULE_RENDERERS[active.id] ?? MODULE_RENDERERS.dashboard
  useKeyboardShortcuts()

  // Close the user dropdown on outside click / Escape.
  useEffect(() => {
    if (!userMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  // ─── Auth gating ──────────────────────────────────────────────────────────
  // When Supabase is configured and the user is genuinely not signed in
  // (loading finished, no user), bounce them to /login so they can sign in.
  // In demo mode (no Supabase) the user is auto-set, so this never fires.
  useEffect(() => {
    if (isSupabaseConfigured() && !loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  // Compute initials from the user's name (or email) for the avatar.
  const displayName = user?.name || (loading ? 'Loading…' : 'Guest')
  const roleLabel = user ? ROLE_TEMPLATES[user.role]?.label ?? user.role : ''
  const initials = (() => {
    if (!user?.name) return loading ? '…' : '?'
    const parts = user.name.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  })()

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    await signOut()
    router.replace('/login')
  }

  // Show a small loading shell while the auth session is being resolved.
  // (Demo mode resolves in ~150ms; real Supabase may take longer.)
  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Loading workspace…</span>
        </div>
      </div>
    )
  }

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

        {/* Breadcrumb — module name + project switcher on mobile too */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <span className="text-sm font-semibold truncate">{active.shortName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          <span className="text-sm text-muted-foreground hidden md:inline">·</span>
          <div className="min-w-0">
            <ProjectSwitcher />
          </div>
        </div>

        <div className="flex-1 hidden sm:block" />

        {/* Right controls */}
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

          {/* Quick Add — visible on mobile (was hidden) */}
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 rounded-md bg-primary text-primary-foreground text-sm transition-colors"
            title="Quick Add"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline ml-1.5">Quick Add</span>
          </button>

          <NotificationsBell />
          <ThemeSwitcher />

          <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

          {/* User — avatar only on mobile */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 h-8 px-1.5 rounded-md hover:bg-accent"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="text-left leading-tight hidden lg:block">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  {displayName}
                  {isDemo && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-normal">
                      demo
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
              </div>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 w-56 pane border border-[var(--pane-divider)] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-3 py-2.5 border-b border-[var(--pane-divider)]">
                  <div className="text-xs font-semibold truncate">{displayName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {roleLabel}
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                >
                  <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                  Sign out
                </button>
              </div>
            )}
          </div>

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
        <ErrorBoundary key={activeModule}>
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
        </ErrorBoundary>
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
