'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  Home,
  Camera,
  MessageSquare,
  MoreHorizontal,
  Loader2,
  LogOut,
  Building2,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Mobile shell ───────────────────────────────────────────────────────────
//
// PWA-installable mobile layout with a bottom tab bar.
// Designed for field users: snap site photos with GPS + timestamp,
// chat with the team, log attendance, receive material (GRN).
// Office users use the desktop layout (/dashboard, /boq, etc.) to
// update the full app with the field data captured here.

type Tab = 'home' | 'capture' | 'chat' | 'more'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'more', label: 'More', icon: MoreHorizontal },
]

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const configured = isSupabaseConfigured()

  // ─── Auth gating ────────────────────────────────────────────────────────
  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace('/login?redirect=/mobile')
    }
  }, [loading, user, configured, router])

  // Derive active tab from pathname — attendance and grn fall under "more"
  const activeTab: Tab = pathname.includes('/mobile/capture')
    ? 'capture'
    : pathname.includes('/mobile/chat')
      ? 'chat'
      : pathname.includes('/mobile/more') ||
          pathname.includes('/mobile/attendance') ||
          pathname.includes('/mobile/grn')
        ? 'more'
        : 'home'

  // Sub-pages get a back button in the header instead of the sign-out
  const isSubPage = pathname.includes('/mobile/attendance') || pathname.includes('/mobile/grn')

  const navigateTo = (tab: Tab) => {
    router.push(`/mobile/${tab === 'home' ? '' : tab}`)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (configured && !user) {
    return null // redirect fired
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header className="border-border flex h-[calc(3rem+env(safe-area-inset-top,0px))] flex-shrink-0 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2">
          {isSubPage ? (
            <button
              onClick={() => router.push('/mobile/more')}
              className="text-muted-foreground active:bg-accent -ml-2 rounded-md p-1.5"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="from-primary to-accent-foreground flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br">
              <Building2 className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight">OmniSite</span>
        </div>
        {!isSubPage && (
          <button
            onClick={async () => {
              await signOut()
              router.replace('/login')
            }}
            className="text-muted-foreground rounded-md p-1.5"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* ─── Content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* ─── Bottom Tab Bar ──────────────────────────────────────────── */}
      <nav className="bg-background border-border fixed right-0 bottom-0 left-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] items-center justify-around border-t pb-[env(safe-area-inset-bottom,0px)]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => navigateTo(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
