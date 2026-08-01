'use client'

import { useApp, ModuleId } from '@/lib/app-store'
import { X, ClipboardList, Mail, Landmark, Truck, FileStack, ShieldAlert, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const ACTIONS: { id: string; label: string; icon: typeof ClipboardList; color: string; desc: string; module: ModuleId }[] = [
  { id: 'dsr', label: 'Daily Site Report', icon: ClipboardList, color: 'text-emerald-500', desc: 'Log today\'s progress', module: 'daily-ops' },
  { id: 'rfi', label: 'RFI', icon: Mail, color: 'text-sky-500', desc: 'Request for Information', module: 'daily-ops' },
  { id: 'expense', label: 'Quick Expense', icon: Landmark, color: 'text-amber-500', desc: 'Record indirect cost', module: 'financials' },
  { id: 'equipment', label: 'Equipment Log', icon: Truck, color: 'text-violet-500', desc: 'Update fleet status', module: 'equipment' },
  { id: 'drawing', label: 'Upload Drawing', icon: FileStack, color: 'text-rose-500', desc: 'Add to register', module: 'drawings' },
  { id: 'ncr', label: 'NCR / Incident', icon: ShieldAlert, color: 'text-red-500', desc: 'Quality/Safety issue', module: 'qs' },
  { id: 'worker', label: 'Add Worker', icon: UserPlus, color: 'text-cyan-500', desc: 'New staff on project', module: 'time-attendance' },
]

export function QuickAddMenu() {
  const { quickAddOpen, setQuickAddOpen, setActiveModule } = useApp()

  return (
    <>
      {quickAddOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
          onClick={() => setQuickAddOpen(false)}
        >
          <div
            className="w-full max-w-md pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)]">
              <div className="text-sm font-semibold">Quick Add</div>
              <button
                onClick={() => setQuickAddOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {ACTIONS.map(a => {
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
                    className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-[var(--pane-divider)] hover:bg-accent hover:border-primary/30 transition-all text-left group"
                  >
                    <Icon className={`w-5 h-5 ${a.color} group-hover:scale-110 transition-transform`} />
                    <div>
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="px-4 py-2 border-t border-[var(--pane-divider)] text-[11px] text-muted-foreground">
              Tip: press <kbd className="px-1 py-0.5 rounded bg-secondary font-mono">⌘K</kbd> anywhere to open the command palette.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
