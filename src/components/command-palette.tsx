'use client'

import { useApp, MODULES } from '@/lib/app-store'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, CornerDownLeft, Hash, ArrowRight } from 'lucide-react'
import { ModuleIcon } from '@/components/module-icon'
import { searchAll, SearchResult } from '@/lib/search-index'
import { cn } from '@/lib/utils'

type CmdEntry = { id: string; label: string; hint?: string; icon: string; action: () => void }

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  'Module': 'text-primary',
  'BOQ Item': 'text-blue-500',
  'Task': 'text-violet-500',
  'Drawing': 'text-rose-500',
  'Letter': 'text-sky-500',
  'Q&S Item': 'text-amber-500',
  'Equipment': 'text-orange-500',
  'Worker': 'text-cyan-500',
  'Requisition': 'text-emerald-500',
  'Subcontractor': 'text-purple-500',
  'CBS Node': 'text-teal-500',
}

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

  // Reset query/selection on open
  const [wasOpen, setWasOpen] = useState(false)
  if (commandOpen && !wasOpen) {
    setWasOpen(true)
    setQuery('')
    setSelected(0)
  } else if (!commandOpen && wasOpen) {
    setWasOpen(false)
  }

  // Global search results
  const searchResults = useMemo(() => searchAll(query, 30), [query])

  // Default actions (shown when query is empty)
  const defaultActions: CmdEntry[] = [
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

  // Filtered default actions (when query is short)
  const filteredActions = query.trim()
    ? defaultActions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
    : defaultActions

  // Combined list: search results first, then filtered actions.
  // Apply the same id-collision filter to the displayed actions so the
  // rendered list and the keyboard-navigable list stay in sync.
  const displayedActions = filteredActions.filter(a => !searchResults.some(r => r.id === a.id))
  const allItems: (SearchResult | CmdEntry)[] = [...searchResults, ...displayedActions]

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[selected]
      if (!item) return
      if ('action' in item) {
        item.action()
      } else {
        // SearchResult — navigate to its module
        setActiveModule(item.module)
        setCommandOpen(false)
      }
    }
  }

  if (!commandOpen) return null

  // Group search results by type for display
  const groupedResults = new Map<string, SearchResult[]>()
  for (const r of searchResults) {
    const arr = groupedResults.get(r.type) || []
    arr.push(r)
    groupedResults.set(r.type, arr)
  }

  const typeOrder: SearchResult['type'][] = ['Module', 'BOQ Item', 'Task', 'Drawing', 'Letter', 'Q&S Item', 'Equipment', 'Worker', 'Requisition', 'Subcontractor', 'CBS Node']
  const sortedTypes = typeOrder.filter(t => groupedResults.has(t))

  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onClick={() => setCommandOpen(false)}
    >
      <div
        className="w-full max-w-xl pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--pane-divider)]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            placeholder="Search BOQ, tasks, drawings, letters, NCRs, equipment, workers…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">ESC</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {/* No results */}
          {allItems.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Search className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <div className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</div>
              <div className="text-xs text-muted-foreground/70 mt-1">Try searching for item codes, task IDs, drawing numbers, or names</div>
            </div>
          )}

          {/* Global search results — grouped by type */}
          {query.trim() && sortedTypes.map(type => {
            const items = groupedResults.get(type)!
            return (
              <div key={type}>
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-secondary/20">
                  {type} · {items.length}
                </div>
                {items.map(r => {
                  const idx = runningIndex++
                  const isSelected = idx === selected
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => { setActiveModule(r.module); setCommandOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <ModuleIcon name={r.icon} className={cn('w-4 h-4 flex-shrink-0', TYPE_COLORS[r.type])} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{r.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.subtitle}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Actions (Quick Add + Modules) — shown when no query or as additional results */}
          {(!query.trim() || displayedActions.length > 0) && (
            <div>
              {query.trim() && sortedTypes.length > 0 && (
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-secondary/20">
                  Actions · {displayedActions.length}
                </div>
              )}
              {displayedActions.map(a => {
                const idx = runningIndex++
                const isSelected = idx === selected
                return (
                  <button
                    key={a.id}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => a.action()}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <ModuleIcon name={a.icon} className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">{a.label}</span>
                    {a.hint && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="w-3 h-3" />{a.hint}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer hint */}
          {allItems.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--pane-divider)] mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-secondary font-mono">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-secondary font-mono">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-secondary font-mono">esc</kbd> close</span>
              </span>
              <span>{allItems.length} results</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
