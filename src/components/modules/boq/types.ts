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
}

export const BOQ_DATA: BoqItem[] = [
  {
    id: '1', code: '1', desc: 'Bridge over Bagmati River', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      {
        id: '1.1', code: '1.1', desc: 'Foundation Works', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '1.1.1', code: '1.1.1', desc: 'Excavation in ordinary soil', type: 'Priced', qty: 1240, uom: 'cum', rate: 485, hasRA: true, level: 2 },
          { id: '1.1.2', code: '1.1.2', desc: 'Stone soling 150mm thick', type: 'Priced', qty: 320, uom: 'cum', rate: 4250, hasRA: true, level: 2 },
          { id: '1.1.3', code: '1.1.3', desc: 'PCC M15 (1:2:4) below footing', type: 'Priced', qty: 88, uom: 'cum', rate: 9800, hasRA: true, level: 2 },
          { id: '1.1.4', code: '1.1.4', desc: 'PCC M20 grade concrete', type: 'Priced', qty: 145, uom: 'cum', rate: 12400, hasRA: true, level: 2 },
        ],
      },
      {
        id: '1.2', code: '1.2', desc: 'Substructure', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '1.2.1', code: '1.2.1', desc: 'Reinforcement steel Fe500 (TMT)', type: 'Priced', qty: 18.5, uom: 'MT', rate: 118000, hasRA: true, level: 2 },
          { id: '1.2.2', code: '1.2.2', desc: 'Shuttering ply waterproof', type: 'Priced', qty: 420, uom: 'sqm', rate: 980, hasRA: true, level: 2 },
          { id: '1.2.3', code: '1.2.3', desc: 'Dewatering provision', type: 'Provisional Sum', qty: 1, uom: 'lot', rate: 250000, level: 2 },
        ],
      },
    ],
  },
  {
    id: '2', code: '2', desc: 'Road Works', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      {
        id: '2.1', code: '2.1', desc: 'Earthwork', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '2.1.1', code: '2.1.1', desc: 'Excavation for road formation', type: 'Priced', qty: 18500, uom: 'cum', rate: 412, hasRA: true, level: 2 },
          { id: '2.1.2', code: '2.1.2', desc: 'Embankment fill (compacted)', type: 'Priced', qty: 8200, uom: 'cum', rate: 385, hasRA: true, level: 2 },
        ],
      },
      {
        id: '2.2', code: '2.2', desc: 'Pavement', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '2.2.1', code: '2.2.1', desc: 'DBM 50mm thick bituminous layer', type: 'Priced', qty: 14200, uom: 'sqm', rate: 1450, hasRA: true, level: 2 },
          { id: '2.2.2', code: '2.2.2', desc: 'BC 40mm wearing course', type: 'Priced', qty: 14200, uom: 'sqm', rate: 1680, hasRA: true, level: 2 },
          { id: '2.2.3', code: '2.2.3', desc: 'Prime coat application', type: 'Daywork', qty: 1, uom: 'lot', rate: 0, level: 2 },
        ],
      },
    ],
  },
  {
    id: '3', code: '3', desc: 'Drainage & Cross Drainage', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      { id: '3.1', code: '3.1', desc: 'Hume pipe NP3 600mm dia', type: 'Priced', qty: 84, uom: 'rmt', rate: 6800, hasRA: true, level: 1 },
      { id: '3.2', code: '3.2', desc: 'Box culvert 2x2m precast', type: 'Priced', qty: 6, uom: 'no', rate: 285000, hasRA: true, level: 1 },
    ],
  },
]

export function flatten(items: BoqItem[]): BoqItem[] {
  const out: BoqItem[] = []
  for (const i of items) {
    out.push(i)
    if (i.children) out.push(...flatten(i.children))
  }
  return out
}
