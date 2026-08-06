'use client'

import { useApp, MODULES } from '@/lib/app-store'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, CornerDownLeft, Hash, ArrowRight } from 'lucide-react'
import { ModuleIcon } from '@/components/module-icon'
import { searchAll, SearchResult, type SearchDataSources } from '@/lib/search-index'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { useSyncedState } from '@/lib/use-synced-state'

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

// ─── Lightweight type stubs for the search data sources ─────────────────────
// The actual module types (BoqItem, Task, etc.) are heavier — for the
// search index we only need a handful of fields, so we declare minimal
// shapes here and trust the runtime to provide them.
interface BoqSearchItem {
  id?: string
  code?: string
  description?: string
  qty?: number
  uom?: string
}
interface TaskSearchItem {
  id: string
  name?: string
}
interface CbsSearchItem {
  code: string
  name?: string
}
interface VendorSearchItem {
  id: string
  name?: string
  scope?: string
  category?: string
}
interface QsSearchItem {
  id: string
  title?: string
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

  // ─── Live data sources from React state (NOT localStorage) ──────────────
  // Each useSyncedState call subscribes to the same Supabase realtime
  // channel the corresponding module uses, so search results are always
  // in sync with the live view. The shared channel cache (in
  // use-synced-state.ts) dedupes the subscriptions so this doesn't add
  // extra network traffic — the data is already in memory because the
  // user has navigated to those modules at least once.
  //
  // If the user hasn't visited a module yet, its data simply isn't
  // loaded — the search index won't include those items until they
  // navigate there. That's the correct tradeoff: no extra fetches for
  // data the user hasn't shown interest in.
  //
  // Replaces the previous localStorage-based read which was a bridge
  // — in Supabase mode, useSyncedState writes to Supabase + localStorage
  // backup, but the localStorage write happens after the state update,
  // so search results could lag behind the live view by one render
  // cycle. (P1-19 in gap analysis.)
  const [boqItems] = useSyncedState<BoqSearchItem[]>(
    'omnisite-boq-data',
    'boq_items',
    () => [] as BoqSearchItem[],
    { primaryKey: 'id' }
  )
  const [tasks] = useSyncedState<TaskSearchItem[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => [] as TaskSearchItem[],
    { primaryKey: 'id' }
  )
  const [cbsNodes] = useSyncedState<CbsSearchItem[]>(
    'omnisite-financials-cbs',
    'cbs_nodes',
    () => [] as CbsSearchItem[],
    { primaryKey: 'code' }
  )
  const [vendors] = useSyncedState<VendorSearchItem[]>(
    'omnisite-vendors',
    'vendors',
    () => [] as VendorSearchItem[],
    { primaryKey: 'id' }
  )
  const [qsItems] = useSyncedState<QsSearchItem[]>(
    'omnisite-qs-items',
    'qs_items',
    () => [] as QsSearchItem[],
    { primaryKey: 'id' }
  )

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

  // Global search results — uses the live React state arrays above.
  // The searchAll function caches the FlexSearch index keyed by the
  // sources' references, so a search query keystroke doesn't rebuild
  // the whole index unless the underlying data actually changed.
  const searchResults = useMemo(() => {
    const sources: SearchDataSources = {
      boqItems,
      tasks,
      cbsNodes,
      // The vendors module stores suppliers + subcontractors in one
      // table. Filter to subcontractors so the existing "Subcontractor"
      // search-result type stays accurate; surfacing suppliers in the
      // palette is a follow-up.
      subcontractors: vendors?.filter((v) => v.category === 'subcontractor'),
      qsItems,
    }
    return searchAll(query, sources, 30)
  }, [query, boqItems, tasks, cbsNodes, vendors, qsItems])

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
