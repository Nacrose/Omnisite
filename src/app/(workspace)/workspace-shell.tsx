'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ModuleId, MODULES, useApp } from '@/lib/app-store'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { QuickAddMenu } from '@/components/quick-add-menu'
import { CommandPalette } from '@/components/command-palette'
import { NotificationsBell } from '@/components/notifications-bell'
import { ProjectSwitcher } from '@/components/project-switcher'
import { StatusBar } from '@/components/status-bar'
import { HelpModal } from '@/components/help-modal'
import { OnboardingTour } from '@/components/onboarding-tour'
import { DockNav } from '@/components/dock-nav'
import { ErrorBoundary } from '@/components/error-boundary'
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts'
import { useAuth } from '@/lib/auth'
import { ROLE_TEMPLATES } from '@/lib/permissions'
import { isSupabaseConfigured } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronDown,
  PanelRight,
  PanelLeft,
  Building2,
  Loader2,
  LogOut,
  Plus,
} from 'lucide-react'

// Derive the active module from the URL pathname. Each module lives at
// /<module-id> (e.g. /boq, /scheduler). The root / redirects to /dashboard.
function moduleFromPath(pathname: string): ModuleId {
  const segment = pathname.split('/').filter(Boolean)[0]
  if (!segment) return 'dashboard'
  const match = MODULES.find((m) => m.id === segment)
  return match ? match.id : 'dashboard'
}

export default function WorkspaceShellRoot({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const {
    activeModule,
    setActiveModule,
    toggleRightPane,
    toggleLeftPane,
    setCommandOpen,
    setQuickAddOpen,
  } = useApp()
  const { user, loading, roleLoading, signOut, isDemo } = useAuth()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Sync the URL → activeModule. When the user navigates via back/forward or
  // a deep link, the pathname changes and we update the store so the dock,
  // status bar, and presence hook reflect the current module.
  const urlModule = moduleFromPath(pathname)
  useEffect(() => {
    if (urlModule !== activeModule) {
      setActiveModule(urlModule)
    }
  }, [urlModule, activeModule, setActiveModule])

  const active = MODULES.find((m) => m.id === activeModule) ?? MODULES[0]
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
  // (loading finished, no user), bounce them to /login. The early return
  // below prevents the shell from flashing before the redirect fires.
  useEffect(() => {
    if (isSupabaseConfigured() && !loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  const displayName = user?.name || (loading ? 'Loading…' : 'Guest')
  const roleLabel = user ? (ROLE_TEMPLATES[user.role]?.label ?? user.role) : ''
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

  if (loading && !user) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <div className="text-muted-foreground flex flex-col items-center gap-3">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
          <span className="text-xs">Loading workspace…</span>
        </div>
      </div>
    )
  }

  // Auth resolved but no user (Supabase configured, not signed in). Render
  // nothing — the effect above is already navigating to /login. Without this
  // early return, the full shell would flash before the redirect completes.
  if (isSupabaseConfigured() && !user) {
    return null
  }

  return (
    <div className="workspace-bg theme-transition flex h-screen w-screen flex-col overflow-hidden">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only z-[100] rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="vibrancy flex h-14 flex-shrink-0 items-center gap-2 border-b border-[var(--pane-divider)] px-2 sm:gap-3 sm:px-4">
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] shadow-sm">
            <Building2 className="h-4 w-4 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex hidden flex-col leading-tight sm:block">
            <span className="text-sm font-bold tracking-tight sm:text-[15px]">OmniSite</span>
            <span className="text-muted-foreground hidden text-[10px] font-medium tracking-wider uppercase md:block">
              Construction Cloud
            </span>
          </div>
        </div>

        <div className="mx-0.5 hidden h-8 w-px bg-[var(--pane-divider)] sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
          <span className="truncate text-sm font-semibold">{active.shortName}</span>
          <ChevronDown className="text-muted-foreground hidden h-3.5 w-3.5 sm:block" />
          <span className="text-muted-foreground hidden text-sm md:inline">·</span>
          <div className="min-w-0">
            <ProjectSwitcher />
          </div>
        </div>

        <div className="hidden flex-1 sm:block" />

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setCommandOpen(true)}
            className="bg-secondary/60 hover:bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors sm:w-auto sm:px-3"
          >
            <Search className="h-4 w-4" />
            <span className="ml-1.5 hidden md:inline">Search…</span>
            <kbd className="bg-background border-border ml-1 hidden rounded border px-1 py-0.5 font-mono text-[10px] md:inline">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={() => setQuickAddOpen(true)}
            disabled={roleLoading}
            className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3"
            title={roleLoading ? 'Resolving permissions…' : 'Quick Add'}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1.5 hidden md:inline">Quick Add</span>
          </button>

          <NotificationsBell />
          <ThemeSwitcher />

          <div className="bg-border mx-0.5 hidden h-6 w-px sm:block" />

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="hover:bg-accent flex h-8 items-center gap-2 rounded-md px-1.5"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="hidden text-left leading-tight lg:block">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {displayName}
                  {isDemo && (
                    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-normal text-amber-700 dark:text-amber-300">
                      demo
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {roleLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Resolving role…
                    </span>
                  ) : (
                    roleLabel
                  )}
                </div>
              </div>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="pane absolute top-full right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--pane-divider)] shadow-2xl"
              >
                <div className="border-b border-[var(--pane-divider)] px-3 py-2.5">
                  <div className="truncate text-xs font-semibold">{displayName}</div>
                  <div className="text-muted-foreground truncate text-[10px]">{user?.email}</div>
                  <div className="bg-primary/10 text-primary mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                    {roleLabel}
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
                >
                  <LogOut className="text-muted-foreground h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={toggleLeftPane}
            className="hover:bg-accent text-muted-foreground hidden rounded-md p-1.5 md:block"
            title="Toggle left pane ([)"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            onClick={toggleRightPane}
            className="hover:bg-accent text-muted-foreground hidden rounded-md p-1.5 md:block"
            title="Toggle inspector (])"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main id="main-content" className="min-h-0 flex-1 overflow-hidden">
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
              {children}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      <div className="hidden md:block">
        <StatusBar />
      </div>

      <DockNav />
      <QuickAddMenu />
      <CommandPalette />
      <HelpModal />
      <OnboardingTour />
    </div>
  )
}
