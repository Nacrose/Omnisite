'use client'

import { Wifi, Users, GitBranch, Cloud, Activity, RotateCcw, Globe, Calendar } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { clearAllPersistentState } from '@/lib/use-persistent-state'
import { usePresence } from '@/lib/use-presence'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { getCurrentBsYear } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function StatusBar() {
  const { activeModule } = useApp()
  const { users, isConnected } = usePresence()
  const { isDemo } = useAuth()
  const { locale, calendar, setLocale, setCalendar } = useI18n()

  const handleReset = () => {
    if (confirm('Reset all data to defaults? This will clear all your edits to BOQ, Schedule, and Financials.')) {
      clearAllPersistentState()
      try { localStorage.removeItem('omnisite-app-store') } catch (e) { /* ignore */ }
      try { localStorage.removeItem('omnisite-theme') } catch (e) { /* ignore */ }
      toast.success('Data reset to defaults', { description: 'Page reloading…' })
      setTimeout(() => window.location.reload(), 800)
    }
  }

  // Real collaborator count = remote users + 1 (us)
  const collaboratorCount = users.length + 1
  // Show up to 4 avatar dots (including us)
  const visibleUsers = users.slice(0, 3)

  // Honest static mode label — no fake "syncing" animation. Demo mode
  // (no Supabase env vars) is the most specific truth; otherwise we
  // fall back to "Local mode" since the app is local-first.
  const modeLabel = isDemo ? 'Demo mode' : 'Local mode'

  return (
    <footer className="h-6 flex-shrink-0 flex items-center gap-4 px-3 border-t border-[var(--pane-divider)] vibrancy text-[10px] text-muted-foreground">
      {/* Sync status — honest static label, no fake "syncing" animation */}
      <span className="flex items-center gap-1.5">
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          isDemo ? 'bg-amber-500' : 'bg-emerald-500'
        )} />
        <span>{modeLabel}</span>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Real-time connection — reflects actual WebSocket status from usePresence() */}
      <span className="flex items-center gap-1.5">
        <div className="relative">
          <Wifi className={cn('w-3 h-3', !isConnected && 'text-amber-500')} />
          <div className={cn(
            'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse',
            isConnected ? 'bg-emerald-500' : 'bg-amber-500'
          )} />
        </div>
        <span>{isConnected ? 'Cloud sync active' : 'Local mode'}</span>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Collaborators — now reflects real presence */}
      <span className="flex items-center gap-1.5">
        <Users className="w-3 h-3" />
        <span>{collaboratorCount} collaborator{collaboratorCount !== 1 ? 's' : ''}</span>
        {/* Avatar dots — us + remote users */}
        <div className="flex -space-x-1.5 ml-1">
          {/* Us (always first) */}
          <div
            className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-[7px] font-semibold ring-1 ring-background"
            title="You · Arjun Sharma"
          >
            AS
          </div>
          {/* Remote users */}
          {visibleUsers.map((u) => (
            <div
              key={u.id}
              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-semibold ring-1 ring-background"
              style={{ background: u.color }}
              title={`${u.name} · viewing ${u.module}`}
            >
              {u.initials}
            </div>
          ))}
          {/* Overflow indicator */}
          {users.length > 3 && (
            <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-[7px] font-semibold ring-1 ring-background">
              +{users.length - 3}
            </div>
          )}
        </div>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Git-style branch */}
      <span className="flex items-center gap-1.5">
        <GitBranch className="w-3 h-3" />
        <span className="font-mono">main</span>
      </span>

      <div className="flex-1" />

      {/* Right side: module + environment */}
      <span className="flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        <span className="capitalize">{activeModule.replace(/-/g, ' ')}</span>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      <span className="flex items-center gap-1.5">
        <Cloud className="w-3 h-3" />
        <span>Cloud · ap-south-1</span>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Language toggle */}
      <button
        onClick={() => {
          const newLocale = locale === 'en' ? 'np' : 'en'
          setLocale(newLocale)
          toast.success(newLocale === 'np' ? 'भाषा: नेपाली' : 'Language: English')
        }}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        title={`Language: ${locale === 'en' ? 'English' : 'नेपाली'}`}
      >
        <Globe className="w-3 h-3" />
        <span>{locale === 'en' ? 'EN' : 'ने'}</span>
      </button>

      {/* Calendar toggle */}
      <button
        onClick={() => {
          const newCal = calendar === 'AD' ? 'BS' : 'AD'
          setCalendar(newCal)
          toast.success(newCal === 'BS' ? `पात्रो: बिक्रम सम्बत ${getCurrentBsYear()}` : 'Calendar: AD')
        }}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        title={`Calendar: ${calendar}`}
      >
        <Calendar className="w-3 h-3" />
        <span>{calendar}</span>
      </button>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Reset button */}
      <button
        onClick={handleReset}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        title="Reset all data to defaults"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Reset</span>
      </button>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      <span className="font-mono">v1.0.0</span>
    </footer>
  )
}
