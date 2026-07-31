import { MODULES, ModuleId } from '@/lib/app-store'

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: 'Module' | 'BOQ Item' | 'Task' | 'Drawing' | 'Letter' | 'Q&S Item' | 'Equipment' | 'Worker' | 'Requisition' | 'Subcontractor' | 'CBS Node'
  module: ModuleId
  icon: string
  keywords: string
}

/**
 * Build a search index from LIVE data in localStorage.
 * Reads the same keys that usePersistentState/useSyncedState write to,
 * so newly added BOQ items, tasks, etc. are immediately searchable.
 */
export function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = []

  // Modules (static — always available)
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

  // Helper: safely read and parse a localStorage key
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

  // BOQ items (from localStorage — matches usePersistentState/useSyncedState keys)
  const boqData = readLocal('omnisite-boq-data')
  if (boqData && Array.isArray(boqData)) {
    for (const item of boqData) {
      const code = item.code || item.id || ''
      const desc = item.desc || item.description || ''
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

  // Schedule tasks
  const taskData = readLocal('omnisite-scheduler-tasks')
  if (taskData && Array.isArray(taskData)) {
    for (const t of taskData) {
      const id = t.id || ''
      const name = t.name || ''
      results.push({
        id: `task-${id}`,
        title: name,
        subtitle: `Task ${id} · Schedule`,
        type: 'Task',
        module: 'scheduler',
        icon: 'GanttChart',
        keywords: `${id} ${name} schedule task`.toLowerCase(),
      })
    }
  }

  // CBS nodes (Financials)
  const cbsData = readLocal('omnisite-financials-cbs')
  if (cbsData && Array.isArray(cbsData)) {
    for (const c of cbsData) {
      const code = c.code || ''
      const name = c.name || ''
      results.push({
        id: `cbs-${code}`,
        title: name,
        subtitle: `CBS ${code} · Financials`,
        type: 'CBS Node',
        module: 'financials',
        icon: 'Landmark',
        keywords: `${code} ${name} cbs financials`.toLowerCase(),
      })
    }
  }

  // Subcontractors
  const scData = readLocal('omnisite-scs')
  if (scData && Array.isArray(scData)) {
    for (const s of scData) {
      const id = s.id || ''
      const name = s.name || ''
      const scope = s.scope || ''
      results.push({
        id: `sc-${id}`,
        title: name,
        subtitle: `${id} · ${scope}`,
        type: 'Subcontractor',
        module: 'subcontractor',
        icon: 'Users',
        keywords: `${id} ${name} ${scope} subcontractor`.toLowerCase(),
      })
    }
  }

  // Q&S items
  const qsData = readLocal('omnisite-qs-items')
  if (qsData && Array.isArray(qsData)) {
    for (const q of qsData) {
      const id = q.id || ''
      const title = q.title || ''
      results.push({
        id: `qs-${id}`,
        title: title,
        subtitle: `${id} · Quality & Safety`,
        type: 'Q&S Item',
        module: 'qs',
        icon: 'ShieldCheck',
        keywords: `${id} ${title} quality safety ncr itr punch incident`.toLowerCase(),
      })
    }
  }

  return results
}

// Search the live index — returns results sorted by relevance
export function searchAll(query: string, limit = 20): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase().trim()
  const terms = q.split(/\s+/)
  const index = buildSearchIndex()

  const scored = index.map(item => {
    let score = 0
    for (const term of terms) {
      if (item.title.toLowerCase().includes(term)) score += 3
      if (item.keywords.includes(term)) score += 2
      if (item.subtitle.toLowerCase().includes(term)) score += 1
    }
    return { item, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.item)
}
