'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ModuleId =
  | 'dashboard'
  | 'boq'
  | 'scheduler'
  | 'daily-ops'
  | 'equipment'
  | 'procurement'
  | 'financials'
  | 'vendors'
  | 'drawings'
  | 'correspondence'
  | 'admin'
  | 'reports'
  | 'qs'
  | 'time-attendance'
  | 'chat'

interface AppState {
  activeModule: ModuleId
  /**
   * Default to `null` so fresh installs don't pretend to know which project
   * is active. The ProjectSwitcher falls back to the first project for
   * display, but no project_id is sent to Supabase queries until the user
   * explicitly picks one — preventing accidental cross-project data leaks
   * on first load.
   */
  activeProject: string | null
  activeProjectId: string | null
  activeProjectDbId: string | null
  setActiveModule: (m: ModuleId) => void
  setActiveProject: (p: string, id: string, dbId: string) => void
  // Persisted pane state
  leftPaneOpen: boolean
  rightPaneOpen: boolean
  toggleLeftPane: () => void
  toggleRightPane: () => void
  // Quick add menu
  quickAddOpen: boolean
  setQuickAddOpen: (b: boolean) => void
  // Command palette
  commandOpen: boolean
  setCommandOpen: (b: boolean) => void
  // Recently viewed modules (most recent first, max 5, no duplicates)
  recentModules: ModuleId[]
  pushRecent: (m: ModuleId) => void
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      activeModule: 'dashboard',
      activeProject: null,
      activeProjectId: null,
      activeProjectDbId: null,
      setActiveModule: (m) => {
        set({ activeModule: m })
        // Track recent — dedupe and prepend, cap at 5
        const prev = get().recentModules.filter((x) => x !== m)
        set({ recentModules: [m, ...prev].slice(0, 5) })
      },
      setActiveProject: (p, id, dbId) =>
        set({ activeProject: p, activeProjectId: id, activeProjectDbId: dbId }),
      leftPaneOpen: true,
      rightPaneOpen: true,
      toggleLeftPane: () => set((s) => ({ leftPaneOpen: !s.leftPaneOpen })),
      toggleRightPane: () => set((s) => ({ rightPaneOpen: !s.rightPaneOpen })),
      quickAddOpen: false,
      setQuickAddOpen: (b) => set({ quickAddOpen: b }),
      commandOpen: false,
      setCommandOpen: (b) => set({ commandOpen: b }),
      recentModules: [],
      pushRecent: (m) => {
        const prev = get().recentModules.filter((x) => x !== m)
        set({ recentModules: [m, ...prev].slice(0, 5) })
      },
    }),
    {
      name: 'omnisite-app-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields (not the transient UI open/close states)
      partialize: (state) => ({
        activeModule: state.activeModule,
        activeProject: state.activeProject,
        activeProjectId: state.activeProjectId,
        activeProjectDbId: state.activeProjectDbId,
        recentModules: state.recentModules,
        leftPaneOpen: state.leftPaneOpen,
        rightPaneOpen: state.rightPaneOpen,
      }),
    }
  )
)

export const MODULES: {
  id: ModuleId
  name: string
  shortName: string
  icon: string
  group: string
}[] = [
  {
    id: 'dashboard',
    name: 'Global Dashboard',
    shortName: 'Home',
    icon: 'LayoutDashboard',
    group: 'Overview',
  },
  {
    id: 'boq',
    name: 'BOQ & Rate Analysis',
    shortName: 'BOQ / RA',
    icon: 'Calculator',
    group: 'Pre-Construction',
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    shortName: 'Schedule',
    icon: 'GanttChart',
    group: 'Pre-Construction',
  },
  {
    id: 'daily-ops',
    name: 'Daily Operations',
    shortName: 'DSR',
    icon: 'ClipboardList',
    group: 'Site Execution',
  },
  {
    id: 'equipment',
    name: 'Equipment & Fleet',
    shortName: 'Equipment',
    icon: 'Truck',
    group: 'Site Execution',
  },
  {
    id: 'procurement',
    name: 'Procurement & Inventory',
    shortName: 'Procurement',
    icon: 'PackageSearch',
    group: 'Site Execution',
  },
  {
    id: 'financials',
    name: 'Financials & Commercial',
    shortName: 'Financials',
    icon: 'Landmark',
    group: 'Project Controls',
  },
  {
    id: 'vendors',
    name: 'Vendors',
    shortName: 'Vendors',
    icon: 'Building2',
    group: 'Project Controls',
  },
  {
    id: 'drawings',
    name: 'Drawings & Documents',
    shortName: 'Drawings',
    icon: 'FileStack',
    group: 'Documents',
  },
  {
    id: 'correspondence',
    name: 'Correspondence',
    shortName: 'Letters',
    icon: 'Mail',
    group: 'Documents',
  },
  { id: 'qs', name: 'Quality & Safety', shortName: 'Q&S', icon: 'ShieldCheck', group: 'Documents' },
  {
    id: 'reports',
    name: 'Report & PDF Designer',
    shortName: 'Reports',
    icon: 'FileBarChart',
    group: 'Documents',
  },
  {
    id: 'time-attendance',
    name: 'Time & Attendance',
    shortName: 'Timecards',
    icon: 'Fingerprint',
    group: 'Resources',
  },
  {
    id: 'admin',
    name: 'Admin & Master Data',
    shortName: 'Admin',
    icon: 'Settings',
    group: 'Resources',
  },
  { id: 'chat', name: 'Messages', shortName: 'Chat', icon: 'MessageSquare', group: 'Resources' },
]

// Keyboard shortcut mapping (single key, fires when not typing in an input)
export const KEYBOARD_SHORTCUTS: Record<string, ModuleId> = {
  h: 'dashboard',
  b: 'boq',
  s: 'scheduler',
  d: 'daily-ops',
  e: 'equipment',
  p: 'procurement',
  f: 'financials',
  v: 'vendors', // 's' taken by scheduler, use 'v' for Vendors
  w: 'drawings', // draWings
  l: 'correspondence', // Letters
  q: 'qs',
  r: 'reports',
  t: 'time-attendance',
  a: 'admin',
  m: 'chat',
}
