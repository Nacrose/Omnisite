'use client'

import { create } from 'zustand'

export type ModuleId =
  | 'dashboard'
  | 'boq'
  | 'scheduler'
  | 'daily-ops'
  | 'equipment'
  | 'procurement'
  | 'financials'
  | 'subcontractor'
  | 'drawings'
  | 'correspondence'
  | 'admin'
  | 'reports'
  | 'qs'
  | 'time-attendance'

interface AppState {
  activeModule: ModuleId
  activeProject: string
  setActiveModule: (m: ModuleId) => void
  setActiveProject: (p: string) => void
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
}

export const useApp = create<AppState>((set) => ({
  activeModule: 'dashboard',
  activeProject: 'Kathmandu Ring Road Expansion — Package 3',
  setActiveModule: (m) => set({ activeModule: m }),
  setActiveProject: (p) => set({ activeProject: p }),
  leftPaneOpen: true,
  rightPaneOpen: true,
  toggleLeftPane: () => set((s) => ({ leftPaneOpen: !s.leftPaneOpen })),
  toggleRightPane: () => set((s) => ({ rightPaneOpen: !s.rightPaneOpen })),
  quickAddOpen: false,
  setQuickAddOpen: (b) => set({ quickAddOpen: b }),
  commandOpen: false,
  setCommandOpen: (b) => set({ commandOpen: b }),
}))

export const MODULES: { id: ModuleId; name: string; shortName: string; icon: string; group: string }[] = [
  { id: 'dashboard', name: 'Global Dashboard', shortName: 'Home', icon: 'LayoutDashboard', group: 'Overview' },
  { id: 'boq', name: 'BOQ & Rate Analysis', shortName: 'BOQ / RA', icon: 'Calculator', group: 'Pre-Construction' },
  { id: 'scheduler', name: 'Scheduler', shortName: 'Schedule', icon: 'GanttChart', group: 'Pre-Construction' },
  { id: 'daily-ops', name: 'Daily Operations', shortName: 'DSR', icon: 'ClipboardList', group: 'Site Execution' },
  { id: 'equipment', name: 'Equipment & Fleet', shortName: 'Equipment', icon: 'Truck', group: 'Site Execution' },
  { id: 'procurement', name: 'Procurement & Inventory', shortName: 'Procurement', icon: 'PackageSearch', group: 'Site Execution' },
  { id: 'financials', name: 'Financials & Commercial', shortName: 'Financials', icon: 'Landmark', group: 'Project Controls' },
  { id: 'subcontractor', name: 'Subcontractor Mgmt', shortName: 'Subcontractor', icon: 'Users', group: 'Project Controls' },
  { id: 'drawings', name: 'Drawings & Documents', shortName: 'Drawings', icon: 'FileStack', group: 'Documents' },
  { id: 'correspondence', name: 'Correspondence', shortName: 'Letters', icon: 'Mail', group: 'Documents' },
  { id: 'qs', name: 'Quality & Safety', shortName: 'Q&S', icon: 'ShieldCheck', group: 'Documents' },
  { id: 'reports', name: 'Report & PDF Designer', shortName: 'Reports', icon: 'FileBarChart', group: 'Documents' },
  { id: 'time-attendance', name: 'Time & Attendance', shortName: 'Timecards', icon: 'Fingerprint', group: 'Resources' },
  { id: 'admin', name: 'Admin & Master Data', shortName: 'Admin', icon: 'Settings', group: 'Resources' },
]
