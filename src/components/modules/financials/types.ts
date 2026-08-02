export interface CbsNode {
  code: string
  name: string
  budget: number
  committed: number
  actual: number
  forecast: number
  marginPct: number
  level: number
  children?: CbsNode[]
  parentCode?: string
}

// Re-export the seed data array so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/financials'.
export { CBS } from '@/data/seed/financials'

export function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function flattenCbs(items: CbsNode[]): CbsNode[] {
  const out: CbsNode[] = []
  for (const i of items) {
    out.push(i)
    if (i.children) out.push(...flattenCbs(i.children))
  }
  return out
}
