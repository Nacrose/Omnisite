'use client'

import { useApp } from '@/lib/app-store'
import { useState, useEffect, useRef } from 'react'
import { Search, CornerDownLeft, Hash } from 'lucide-react'
import { MODULES } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { cn } from '@/lib/utils'

type CmdEntry = { id: string; label: string; hint?: string; icon: string; action: () => void }

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setActiveModule, setQuickAddOpen } = useApp()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setCommandOpen])

  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandOpen])

  // Reset query/selection only when transitioning from closed → open (derived from prop, no setState in effect).
  const [wasOpen, setWasOpen] = useState(false)
  if (commandOpen && !wasOpen) {
    setWasOpen(true)
    setQuery('')
    setSelected(0)
  } else if (!commandOpen && wasOpen) {
    setWasOpen(false)
  }

  if (!commandOpen) return null

  const actions: CmdEntry[] = [
    ...MODULES.map(m => ({
      id: `nav-${m.id}`,
      label: m.name,
      hint: m.group,
      icon: m.icon,
      action: () => { setActiveModule(m.id); setCommandOpen(false) },
    })),
    { id: 'qa-dsr', label: 'Quick Add: Daily Site Report', icon: 'ClipboardList', action: () => { setQuickAddOpen(true); setCommandOpen(false) } },
    { id: 'qa-rfi', label: 'Quick Add: RFI', icon: 'Mail', action: () => { setQuickAddOpen(true); setCommandOpen(false) } },
    { id: 'qa-expense', label: 'Quick Add: Quick Expense', icon: 'Landmark', action: () => { setQuickAddOpen(true); setCommandOpen(false) } },
    { id: 'qa-equipment', label: 'Quick Add: Equipment Log', icon: 'Truck', action: () => { setQuickAddOpen(true); setCommandOpen(false) } },
  ]

  const filtered = actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); filtered[selected]?.action() }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-xl pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--pane-divider)]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            placeholder="Search modules, actions, documents…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results for “{query}”</div>
          )}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              onMouseEnter={() => setSelected(i)}
              onClick={() => a.action()}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                i === selected ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <ModuleIcon name={a.icon} className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">{a.label}</span>
              {a.hint && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="w-3 h-3" />{a.hint}
                </span>
              )}
              {i === selected && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
