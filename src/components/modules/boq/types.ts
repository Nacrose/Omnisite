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
  /** Optional FK to project_locations.id — where this BOQ item physically
   *  applies (e.g. "Pier 3" or "0+200 to 0+400"). Persisted to the
   *  `location_id` column (added in migration 12) and round-tripped via the
   *  `locationId: 'location_id'` fieldMap entry in boq/index.tsx. */
  locationId?: string
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
