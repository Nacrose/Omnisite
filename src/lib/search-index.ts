import { MODULES, ModuleId } from '@/lib/app-store'
import { Index as FlexSearchIndex } from 'flexsearch'

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: string
  module: ModuleId
  icon: string
  keywords: string
}

/**
 * Data sources for the search index. Passed in by the caller (the
 * CommandPalette) from React state — NOT read from localStorage directly.
 *
 * This fixes the stale-search bug where search results could lag behind
 * the live state because localStorage is written after state updates.
 *
 * Each field is optional so the caller can pass only what it has.
 */
export interface SearchDataSources {
  boqItems?: Array<{
    id?: string
    code?: string
    desc?: string
    description?: string
    qty?: number
    uom?: string
  }>
  tasks?: Array<{ id: string; name?: string }>
  cbsNodes?: Array<{ code: string; name?: string }>
  subcontractors?: Array<{ id: string; name?: string; scope?: string }>
  qsItems?: Array<{ id: string; title?: string }>
}

// ─── Cached FlexSearch index ────────────────────────────────────────────────
let searchIndex: FlexSearchIndex | null = null
let cachedResults: SearchResult[] = []
let lastBuildTime = 0
let lastSources: SearchDataSources | null = null
const BUILD_DEBOUNCE = 2000

function buildResults(sources: SearchDataSources): SearchResult[] {
  const results: SearchResult[] = []

  // Modules are static — always include them.
  for (const m of MODULES) {
    results.push({
      id: `mod-${m.id}`,
      title: m.name,
      subtitle: `Module · ${m.group}`,
      type: 'Module',
      module: m.id,
      icon: m.icon,
      keywords: `${m.name} ${m.shortName} ${m.group} module`.toLowerCase(),
    })
  }

  // BOQ items — from React state, not localStorage.
  if (sources.boqItems && Array.isArray(sources.boqItems)) {
    for (const item of sources.boqItems) {
      const code = item.code || item.id || ''
      const desc = item.desc || item.description || ''
      if (!code && !desc) continue
      results.push({
        id: `boq-${code}`,
        title: desc,
        subtitle: `BOQ ${code} · ${item.qty || 0} ${item.uom || ''}`,
        type: 'BOQ Item',
        module: 'boq',
        icon: 'Calculator',
        keywords: `${code} ${desc} ${item.uom || ''} boq`.toLowerCase(),
      })
    }
  }

  // Tasks — from React state.
  if (sources.tasks && Array.isArray(sources.tasks)) {
    for (const t of sources.tasks) {
      if (!t.id) continue
      results.push({
        id: `task-${t.id}`,
        title: t.name || '',
        subtitle: `Task ${t.id} · Schedule`,
        type: 'Task',
        module: 'scheduler',
        icon: 'GanttChart',
        keywords: `${t.id} ${t.name} schedule task`.toLowerCase(),
      })
    }
  }

  // CBS nodes — from React state.
  if (sources.cbsNodes && Array.isArray(sources.cbsNodes)) {
    for (const c of sources.cbsNodes) {
      if (!c.code) continue
      results.push({
        id: `cbs-${c.code}`,
        title: c.name || '',
        subtitle: `CBS ${c.code} · Financials`,
        type: 'CBS Node',
        module: 'financials',
        icon: 'Landmark',
        keywords: `${c.code} ${c.name} cbs financials`.toLowerCase(),
      })
    }
  }

  // Subcontractors — from React state.
  if (sources.subcontractors && Array.isArray(sources.subcontractors)) {
    for (const s of sources.subcontractors) {
      if (!s.id) continue
      results.push({
        id: `sc-${s.id}`,
        title: s.name || '',
        subtitle: `${s.id} · ${s.scope || ''}`,
        type: 'Subcontractor',
        module: 'subcontractor',
        icon: 'Users',
        keywords: `${s.id} ${s.name} ${s.scope || ''} subcontractor`.toLowerCase(),
      })
    }
  }

  // Q&S items — from React state.
  if (sources.qsItems && Array.isArray(sources.qsItems)) {
    for (const q of sources.qsItems) {
      if (!q.id) continue
      results.push({
        id: `qs-${q.id}`,
        title: q.title || '',
        subtitle: `${q.id} · Quality & Safety`,
        type: 'Q&S Item',
        module: 'qs',
        icon: 'ShieldCheck',
        keywords: `${q.id} ${q.title} quality safety ncr itr punch incident`.toLowerCase(),
      })
    }
  }

  return results
}

/**
 * Check if the data sources have changed (by reference + length).
 * Avoids rebuilding the index on every keystroke if data hasn't changed.
 */
function sourcesChanged(a: SearchDataSources | null, b: SearchDataSources): boolean {
  if (!a) return true
  return (
    a.boqItems !== b.boqItems ||
    a.tasks !== b.tasks ||
    a.cbsNodes !== b.cbsNodes ||
    a.subcontractors !== b.subcontractors ||
    a.qsItems !== b.qsItems
  )
}

function ensureIndex(sources: SearchDataSources): FlexSearchIndex {
  const now = Date.now()
  const changed = sourcesChanged(lastSources, sources)
  if (!searchIndex || changed || now - lastBuildTime > BUILD_DEBOUNCE) {
    cachedResults = buildResults(sources)
    searchIndex = new FlexSearchIndex({ cache: 100 })
    for (const item of cachedResults) {
      searchIndex.add(item.id, `${item.title} ${item.keywords} ${item.subtitle}`)
    }
    lastBuildTime = now
    lastSources = sources
  }
  return searchIndex
}

/**
 * Search across all data sources. The caller passes the live data arrays
 * from React state — this ensures search results are always in sync with
 * the current view, not a stale localStorage snapshot.
 *
 * @param query - Search query string
 * @param sources - Data arrays from React state (boqItems, tasks, etc.)
 * @param limit - Max results to return (default 20)
 */
export function searchAll(query: string, sources: SearchDataSources, limit = 20): SearchResult[] {
  if (!query.trim()) return []
  const index = ensureIndex(sources)
  const ids = index.search(query, limit) as unknown as string[]
  return ids
    .map((id: string) => cachedResults.find((it) => it.id === id))
    .filter((it: SearchResult | undefined): it is SearchResult => !!it)
}
