'use client'

import { useApp, ModuleId } from '@/lib/app-store'
import {
  X,
  ClipboardList,
  Mail,
  Landmark,
  Truck,
  FileStack,
  ShieldAlert,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

const ACTIONS: {
  id: string
  label: string
  icon: typeof ClipboardList
  color: string
  desc: string
  module: ModuleId
}[] = [
  {
    id: 'dsr',
    label: 'Daily Site Report',
    icon: ClipboardList,
    color: 'text-emerald-500',
    desc: "Log today's progress",
    module: 'daily-ops',
  },
  {
    id: 'rfi',
    label: 'RFI',
    icon: Mail,
    color: 'text-sky-500',
    desc: 'Request for Information',
    module: 'daily-ops',
  },
  {
    id: 'expense',
    label: 'Quick Expense',
    icon: Landmark,
    color: 'text-amber-500',
    desc: 'Record indirect cost',
    module: 'financials',
  },
  {
    id: 'equipment',
    label: 'Equipment Log',
    icon: Truck,
    color: 'text-violet-500',
    desc: 'Update fleet status',
    module: 'equipment',
  },
  {
    id: 'drawing',
    label: 'Upload Drawing',
    icon: FileStack,
    color: 'text-rose-500',
    desc: 'Add to register',
    module: 'drawings',
  },
  {
    id: 'ncr',
    label: 'NCR / Incident',
    icon: ShieldAlert,
    color: 'text-red-500',
    desc: 'Quality/Safety issue',
    module: 'qs',
  },
  {
    id: 'worker',
    label: 'Add Worker',
    icon: UserPlus,
    color: 'text-cyan-500',
    desc: 'New staff on project',
    module: 'time-attendance',
  },
]

export function QuickAddMenu() {
  const { quickAddOpen, setQuickAddOpen, setActiveModule } = useApp()

  return (
    <>
      {quickAddOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-[12vh] backdrop-blur-sm"
          onClick={() => setQuickAddOpen(false)}
        >
          <div
            className="pane animate-in fade-in slide-in-from-top-4 w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
              <div className="text-sm font-semibold">Quick Add</div>
              <button
                onClick={() => setQuickAddOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {ACTIONS.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      setActiveModule(a.module)
                      toast.success(`Navigated to ${a.label}`, {
                        description: `Switched to the ${a.module} module`,
                      })
                      setQuickAddOpen(false)
                    }}
                    className="hover:bg-accent hover:border-primary/30 group flex flex-col items-start gap-1.5 rounded-lg border border-[var(--pane-divider)] p-3 text-left transition-all"
                  >
                    <Icon
                      className={`h-5 w-5 ${a.color} transition-transform group-hover:scale-110`}
                    />
                    <div>
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-muted-foreground text-xs">{a.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="text-muted-foreground border-t border-[var(--pane-divider)] px-4 py-2 text-[11px]">
              Tip: press <kbd className="bg-secondary rounded px-1 py-0.5 font-mono">⌘K</kbd>{' '}
              anywhere to open the command palette.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
