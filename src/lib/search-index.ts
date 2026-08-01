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

// ─── Cached FlexSearch index ────────────────────────────────────────────────
let searchIndex: FlexSearchIndex | null = null
let cachedResults: SearchResult[] = []
let lastBuildTime = 0
const BUILD_DEBOUNCE = 2000

function buildResults(): SearchResult[] {
  const results: SearchResult[] = []

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

  const readLocal = (key: string): any[] | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const boqData = readLocal('omnisite-boq-data')
  if (boqData && Array.isArray(boqData)) {
    for (const item of boqData) {
      const code = item.code || item.id || ''
      const desc = item.desc || item.description || ''
      results.push({
        id: `boq-${code}`, title: desc, subtitle: `BOQ ${code} · ${item.qty || 0} ${item.uom || ''}`,
        type: 'BOQ Item', module: 'boq', icon: 'Calculator',
        keywords: `${code} ${desc} ${item.uom || ''} boq`.toLowerCase(),
      })
    }
  }

  const taskData = readLocal('omnisite-scheduler-tasks')
  if (taskData && Array.isArray(taskData)) {
    for (const t of taskData) {
      results.push({
        id: `task-${t.id}`, title: t.name || '', subtitle: `Task ${t.id} · Schedule`,
        type: 'Task', module: 'scheduler', icon: 'GanttChart',
        keywords: `${t.id} ${t.name} schedule task`.toLowerCase(),
      })
    }
  }

  const cbsData = readLocal('omnisite-financials-cbs')
  if (cbsData && Array.isArray(cbsData)) {
    for (const c of cbsData) {
      results.push({
        id: `cbs-${c.code}`, title: c.name || '', subtitle: `CBS ${c.code} · Financials`,
        type: 'CBS Node', module: 'financials', icon: 'Landmark',
        keywords: `${c.code} ${c.name} cbs financials`.toLowerCase(),
      })
    }
  }

  const scData = readLocal('omnisite-scs')
  if (scData && Array.isArray(scData)) {
    for (const s of scData) {
      results.push({
        id: `sc-${s.id}`, title: s.name || '', subtitle: `${s.id} · ${s.scope || ''}`,
        type: 'Subcontractor', module: 'subcontractor', icon: 'Users',
        keywords: `${s.id} ${s.name} ${s.scope || ''} subcontractor`.toLowerCase(),
      })
    }
  }

  const qsData = readLocal('omnisite-qs-items')
  if (qsData && Array.isArray(qsData)) {
    for (const q of qsData) {
      results.push({
        id: `qs-${q.id}`, title: q.title || '', subtitle: `${q.id} · Quality & Safety`,
        type: 'Q&S Item', module: 'qs', icon: 'ShieldCheck',
        keywords: `${q.id} ${q.title} quality safety ncr itr punch incident`.toLowerCase(),
      })
    }
  }

  return results
}

function ensureIndex(): FlexSearchIndex {
  const now = Date.now()
  if (!searchIndex || now - lastBuildTime > BUILD_DEBOUNCE) {
    cachedResults = buildResults()
    searchIndex = new FlexSearchIndex({ cache: 100 })
    for (const item of cachedResults) {
      searchIndex.add(item.id, `${item.title} ${item.keywords} ${item.subtitle}`)
    }
    lastBuildTime = now
  }
  return searchIndex
}

export function searchAll(query: string, limit = 20): SearchResult[] {
  if (!query.trim()) return []
  const index = ensureIndex()
  const ids = index.search(query, limit) as unknown as string[]
  return ids
    .map((id: string) => cachedResults.find(it => it.id === id))
    .filter((it: SearchResult | undefined): it is SearchResult => !!it)
}
