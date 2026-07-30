'use client'

import { useState, useEffect } from 'react'
import { Wifi, Users, Save, GitBranch, CheckCircle2, Cloud, Activity, RotateCcw } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { clearAllPersistentState } from '@/lib/use-persistent-state'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

export function StatusBar() {
  const { activeModule } = useApp()
  const [lastSaved, setLastSaved] = useState(Date.now())
  const [savedAgo, setSavedAgo] = useState('just now')
  const [collaboratorCount] = useState(4)
  const [isSyncing, setIsSyncing] = useState(false)

  // Auto-save tick: every 8 seconds, briefly show "syncing" then "saved"
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSyncing(true)
      setTimeout(() => {
        setIsSyncing(false)
        setLastSaved(Date.now())
      }, 700)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  // Update "saved X ago" every 5 seconds
  useEffect(() => {
    const updateAgo = () => {
      const seconds = Math.floor((Date.now() - lastSaved) / 1000)
      if (seconds < 5) setSavedAgo('just now')
      else if (seconds < 60) setSavedAgo(`${seconds}s ago`)
      else setSavedAgo(`${Math.floor(seconds / 60)}m ago`)
    }
    updateAgo()
    const t = setInterval(updateAgo, 5000)
    return () => clearInterval(t)
  }, [lastSaved])

  const handleReset = () => {
    if (confirm('Reset all data to defaults? This will clear all your edits to BOQ, Schedule, and Financials.')) {
      clearAllPersistentState()
      // Also clear the Zustand persist storage
      try { localStorage.removeItem('omnisite-app-store') } catch (e) { /* ignore */ }
      try { localStorage.removeItem('omnisite-theme') } catch (e) { /* ignore */ }
      toast.success('Data reset to defaults', { description: 'Page reloading…' })
      setTimeout(() => window.location.reload(), 800)
    }
  }

  return (
    <footer className="h-6 flex-shrink-0 flex items-center gap-4 px-3 border-t border-[var(--pane-divider)] vibrancy text-[10px] text-muted-foreground">
      {/* Sync status */}
      <span className="flex items-center gap-1.5">
        {isSyncing ? (
          <>
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-primary font-medium">Syncing…</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Saved {savedAgo}</span>
          </>
        )}
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Real-time connection */}
      <span className="flex items-center gap-1.5">
        <div className="relative">
          <Wifi className="w-3 h-3" />
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span>Real-time connected</span>
      </span>

      <div className="w-px h-3 bg-[var(--pane-divider)]" />

      {/* Collaborators */}
      <span className="flex items-center gap-1.5">
        <Users className="w-3 h-3" />
        <span>{collaboratorCount} collaborators</span>
        {/* Avatar dots */}
        <div className="flex -space-x-1.5 ml-1">
          {[
            { c: 'from-orange-400 to-rose-500', i: 'AS' },
            { c: 'from-sky-400 to-blue-600', i: 'BR' },
            { c: 'from-emerald-400 to-green-600', i: 'SG' },
            { c: 'from-violet-400 to-purple-600', i: 'RB' },
          ].map((u, i) => (
            <div
              key={i}
              className={cn(
                'w-4 h-4 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[7px] font-semibold ring-1 ring-background',
                u.c
              )}
              title={u.i}
            >
              {u.i}
            </div>
          ))}
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

      <span className="font-mono">v0.9.5-beta</span>
      <Toaster richColors position="top-center" />
    </footer>
  )
}
