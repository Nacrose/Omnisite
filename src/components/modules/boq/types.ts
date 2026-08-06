export interface BoqItem {
  id: string
  code: string
  desc: string
  type: 'Priced' | 'Provisional Sum' | 'Daywork' | 'Heading'
  qty: number
  uom: string
  rate: number
  hasRA?: boolean
  level: number
  children?: BoqItem[]
  parentId?: string
  locationId?: string
  /** Rate Analysis data — persisted to ra_data JSONB column (migration 27).
   *  Stores materials, labour, equipment, pctCosts, customPctCosts, opPct
   *  so RA is shared across users and devices (not just localStorage). */
  raData?: Record<string, unknown>
}

// Re-export the seed data array so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/boq' to keep this
// file focused on the type contract.
export { BOQ_DATA } from '@/data/seed/boq'

export function flatten(items: BoqItem[]): BoqItem[] {
  const out: BoqItem[] = []
  for (const i of items) {
    out.push(i)
    if (i.children) out.push(...flatten(i.children))
  }
  return out
}
