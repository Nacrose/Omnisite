'use client'

import { useApp, MODULES } from '@/lib/app-store'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, CornerDownLeft, Hash, ArrowRight } from 'lucide-react'
import { ModuleIcon } from '@/components/module-icon'
import { searchAll, SearchResult, type SearchDataSources } from '@/lib/search-index'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/use-focus-trap'

type CmdEntry = { id: string; label: string; hint?: string; icon: string; action: () => void }

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  Module: 'text-primary',
  'BOQ Item': 'text-blue-500',
  Task: 'text-violet-500',
  Drawing: 'text-rose-500',
  Letter: 'text-sky-500',
  'Q&S Item': 'text-amber-500',
  Equipment: 'text-orange-500',
  Worker: 'text-cyan-500',
  Requisition: 'text-emerald-500',
  Subcontractor: 'text-purple-500',
  'CBS Node': 'text-teal-500',
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setQuickAddOpen } = useApp()
  const router = useRouter()
  const navigateToModule = (id: string) => {
    router.push(`/${id}`)
    setCommandOpen(false)
  }
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, commandOpen)

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

  // Global search results — pass live data from localStorage (written by
  // useSyncedState). This is a bridge: ideally the palette would subscribe
  // to each module's React state directly, but that requires a larger
  // refactor (context or zustand store for all module data). The localStorage
  // read here is at least explicit about what it's doing, and the searchAll
  // function no longer reads localStorage itself.
  const searchResults = useMemo(() => {
    const readLocal = (key: string) => {
      if (typeof window === 'undefined') return undefined
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : undefined
      } catch {
        return undefined
      }
    }
    const sources: SearchDataSources = {
      boqItems: readLocal('omnisite-boq-data'),
      tasks: readLocal('omnisite-scheduler-tasks'),
      cbsNodes: readLocal('omnisite-financials-cbs'),
      subcontractors: readLocal('omnisite-scs'),
      qsItems: readLocal('omnisite-qs-items'),
    }
    return searchAll(query, sources, 30)
  }, [query])

  // Default actions (shown when query is empty)
  const defaultActions: CmdEntry[] = [
    ...MODULES.map((m) => ({
      id: `nav-${m.id}`,
      label: m.name,
      hint: m.group,
      icon: m.icon,
      action: () => navigateToModule(m.id),
    })),
    {
      id: 'qa-dsr',
      label: 'Quick Add: Daily Site Report',
      icon: 'ClipboardList',
      action: () => {
        setQuickAddOpen(true)
        setCommandOpen(false)
      },
    },
    {
      id: 'qa-rfi',
      label: 'Quick Add: RFI',
      icon: 'Mail',
      action: () => {
        setQuickAddOpen(true)
        setCommandOpen(false)
      },
    },
    {
      id: 'qa-expense',
      label: 'Quick Add: Quick Expense',
      icon: 'Landmark',
      action: () => {
        setQuickAddOpen(true)
        setCommandOpen(false)
      },
    },
    {
      id: 'qa-equipment',
      label: 'Quick Add: Equipment Log',
      icon: 'Truck',
      action: () => {
        setQuickAddOpen(true)
        setCommandOpen(false)
      },
    },
  ]

  // Filtered default actions (when query is short)
  const filteredActions = query.trim()
    ? defaultActions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : defaultActions

  // Combined list: search results first, then filtered actions.
  // Apply the same id-collision filter to the displayed actions so the
  // rendered list and the keyboard-navigable list stay in sync.
  const displayedActions = filteredActions.filter((a) => !searchResults.some((r) => r.id === a.id))
  const allItems: (SearchResult | CmdEntry)[] = [...searchResults, ...displayedActions]

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, allItems.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[selected]
      if (!item) return
      if ('action' in item) {
        item.action()
      } else {
        // SearchResult — navigate to its module
        navigateToModule(item.module)
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

  const typeOrder: SearchResult['type'][] = [
    'Module',
    'BOQ Item',
    'Task',
    'Drawing',
    'Letter',
    'Q&S Item',
    'Equipment',
    'Worker',
    'Requisition',
    'Subcontractor',
    'CBS Node',
  ]
  const sortedTypes = typeOrder.filter((t) => groupedResults.has(t))

  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh] backdrop-blur-sm"
      onClick={() => setCommandOpen(false)}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="pane w-full max-w-xl overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex h-14 items-center gap-3 border-b border-[var(--pane-divider)] px-4">
          <Search className="text-muted-foreground h-4 w-4" />
          <input
            ref={inputRef}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-expanded="true"
            aria-activedescendant={
              selected >= 0 && selected < allItems.length ? `cmd-item-${selected}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={handleKey}
            placeholder="Search BOQ, tasks, drawings, letters, NCRs, equipment, workers…"
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
            ESC
          </kbd>
        </div>

        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Command palette results"
          className="max-h-[420px] overflow-y-auto py-2"
        >
          {/* No results */}
          {allItems.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Search className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
              <div className="text-muted-foreground text-sm">
                No results for &ldquo;{query}&rdquo;
              </div>
              <div className="text-muted-foreground/70 mt-1 text-xs">
                Try searching for item codes, task IDs, drawing numbers, or names
              </div>
            </div>
          )}

          {/* Global search results — grouped by type */}
          {query.trim() &&
            sortedTypes.map((type) => {
              const items = groupedResults.get(type)!
              return (
                <div key={type}>
                  <div className="text-muted-foreground/70 bg-secondary/20 px-4 py-1 text-[10px] font-semibold tracking-wider uppercase">
                    {type} · {items.length}
                  </div>
                  {items.map((r) => {
                    const idx = runningIndex++
                    const isSelected = idx === selected
                    return (
                      <button
                        key={r.id}
                        id={`cmd-item-${idx}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => navigateToModule(r.module)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                        )}
                      >
                        <ModuleIcon
                          name={r.icon}
                          className={cn('h-4 w-4 flex-shrink-0', TYPE_COLORS[r.type])}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{r.title}</div>
                          <div className="text-muted-foreground truncate text-[11px]">
                            {r.subtitle}
                          </div>
                        </div>
                        <ArrowRight className="text-muted-foreground h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                        {isSelected && (
                          <CornerDownLeft className="text-muted-foreground h-3.5 w-3.5" />
                        )}
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
                <div className="text-muted-foreground/70 bg-secondary/20 px-4 py-1 text-[10px] font-semibold tracking-wider uppercase">
                  Actions · {displayedActions.length}
                </div>
              )}
              {displayedActions.map((a) => {
                const idx = runningIndex++
                const isSelected = idx === selected
                return (
                  <button
                    key={a.id}
                    id={`cmd-item-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => a.action()}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <ModuleIcon name={a.icon} className="text-muted-foreground h-4 w-4" />
                    <span className="flex-1">{a.label}</span>
                    {a.hint && (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Hash className="h-3 w-3" />
                        {a.hint}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="text-muted-foreground h-3.5 w-3.5" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer hint */}
          {allItems.length > 0 && (
            <div className="text-muted-foreground mt-2 flex items-center justify-between border-t border-[var(--pane-divider)] px-4 py-2 text-[10px]">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded px-1 font-mono">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded px-1 font-mono">↵</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-secondary rounded px-1 font-mono">esc</kbd> close
                </span>
              </span>
              <span>{allItems.length} results</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
