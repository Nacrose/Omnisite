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

// ─── BOQ Items ───────────────────────────────────────────────────────────────
const BOQ_ITEMS = [
  { code: '1.1.1', desc: 'Excavation in ordinary soil', qty: 1240, uom: 'cum' },
  { code: '1.1.2', desc: 'Stone soling 150mm thick', qty: 320, uom: 'cum' },
  { code: '1.1.3', desc: 'PCC M15 (1:2:4) below footing', qty: 145, uom: 'cum' },
  { code: '1.1.4', desc: 'PCC M20 grade concrete', qty: 145, uom: 'cum' },
  { code: '1.2.1', desc: 'Reinforcement steel Fe500 (TMT)', qty: 18.5, uom: 'MT' },
  { code: '1.2.2', desc: 'Shuttering ply waterproof', qty: 420, uom: 'sqm' },
  { code: '2.1.1', desc: 'Excavation for road formation', qty: 18500, uom: 'cum' },
  { code: '2.1.2', desc: 'Embankment fill (compacted)', qty: 8200, uom: 'cum' },
  { code: '2.2.1', desc: 'DBM 50mm thick bituminous layer', qty: 14200, uom: 'sqm' },
  { code: '2.2.2', desc: 'BC 40mm wearing course', qty: 14200, uom: 'sqm' },
  { code: '3.1', desc: 'Hume pipe NP3 600mm dia', qty: 84, uom: 'rmt' },
  { code: '3.2', desc: 'Box culvert 2x2m precast', qty: 6, uom: 'no' },
]

// ─── Schedule Tasks ──────────────────────────────────────────────────────────
const SCHEDULE_TASKS = [
  { id: 'T-101', name: 'Setup site office & storage' },
  { id: 'T-102', name: 'Plant & machinery deployment' },
  { id: 'T-103', name: 'Mobilization milestone' },
  { id: 'T-201', name: 'Excavation ch. 0+000 to 1+200' },
  { id: 'T-202', name: 'Stone soling layer' },
  { id: 'T-203', name: 'PCC M15 pouring' },
  { id: 'T-204', name: 'PCC curing period' },
  { id: 'T-301', name: 'Hammock — Tunneling uncertain' },
  { id: 'T-302', name: 'Base slab concrete' },
  { id: 'T-303', name: 'Wall & slab rebar' },
  { id: 'T-401', name: 'Subgrade preparation' },
  { id: 'T-402', name: 'DBM 50mm layer' },
  { id: 'T-403', name: 'BC wearing course' },
  { id: 'T-404', name: 'Road opening milestone' },
]

// ─── Drawings ────────────────────────────────────────────────────────────────
const DRAWINGS = [
  { number: 'KRR-P3-BR-DR-001', title: 'Bridge General Arrangement — Plan & Elevation', rev: 'C' },
  { number: 'KRR-P3-RD-DR-014', title: 'Pavement Cross-section — DBM+BC', rev: 'B' },
  { number: 'KRR-P3-DR-DR-008', title: 'Box Culvert 2×2m — Reinforcement Details', rev: 'A' },
  { number: 'KRR-P3-BR-DR-005', title: 'Pier P-4 — Rebar Detailing', rev: 'A' },
]

// ─── Letters / Correspondence ────────────────────────────────────────────────
const LETTERS = [
  { number: 'CL/DOR/2026-087', subject: 'Approval — PCC mix design for foundation' },
  { number: 'OMS/2026-142', subject: 'RE: PCC mix design — additional test results' },
  { number: 'SI/2026-022', subject: 'SI: Extra excavation at chainage 2+850' },
  { number: 'CL/DOR/2026-088', subject: 'Request for clarification — rebar detailing' },
  { number: 'OMS/2026-138', subject: 'EOT claim — additional 14 days for rock excavation' },
]

// ─── Q&S Items ───────────────────────────────────────────────────────────────
const QS_ITEMS = [
  { id: 'ITR-042', title: 'PCC M15 — footing at ch. 4+200 to 4+350' },
  { id: 'ITR-041', title: 'Stone soling at pier P-4' },
  { id: 'NCR-034', title: 'Rebar cover < 40mm at box culvert base slab' },
  { id: 'NCR-033', title: 'Honeycombing in PCC at ch. 4+050' },
  { id: 'PCH-018', title: 'Smooth edges at expansion joint' },
  { id: 'INC-005', title: 'Worker minor cut at rebar yard' },
  { id: 'NM-012', title: 'Tipper reversing without spotter' },
]

// ─── Equipment ───────────────────────────────────────────────────────────────
const EQUIPMENT = [
  { id: 'E-001', name: 'JCB 3DX Excavator' },
  { id: 'E-002', name: 'Tata 1109 Tipper' },
  { id: 'E-003', name: 'Concrete Mixer 0.4 cum' },
  { id: 'E-004', name: 'Needle Vibrator 60mm' },
  { id: 'E-005', name: 'Batching Plant 30 cum/hr' },
]

// ─── Workers ─────────────────────────────────────────────────────────────────
const WORKERS = [
  { id: 'W-001', name: 'Ram Bahadur Thapa', trade: 'Mason (Skilled)' },
  { id: 'W-002', name: 'Sita Gurung', trade: 'Mazdoor (Unskilled)' },
  { id: 'W-003', name: 'Hari Karki', trade: 'Bar bender' },
  { id: 'W-004', name: 'Bikas Tamang', trade: 'Mazdoor (Unskilled)' },
  { id: 'W-005', name: 'Gopal Shrestha', trade: 'Operator' },
  { id: 'W-006', name: 'Anita Lama', trade: 'Helper' },
]

// ─── Requisitions ────────────────────────────────────────────────────────────
const REQUISITIONS = [
  { id: 'REQ-0142', item: 'Cement OPC 53 Grade' },
  { id: 'REQ-0143', item: 'TMT Steel Fe500 16mm' },
  { id: 'REQ-0144', item: 'Shuttering Ply 18mm' },
]

// ─── Subcontractors ──────────────────────────────────────────────────────────
const SUBCONTRACTORS = [
  { id: 'SC-01', name: 'M/S Lama Constructions', scope: 'Box culvert construction' },
  { id: 'SC-02', name: 'Shrestha Steel Works', scope: 'Rebar fabrication & fixing' },
  { id: 'SC-03', name: 'Himal Pavements Pvt Ltd', scope: 'DBM & BC laying' },
]

// ─── CBS Nodes ───────────────────────────────────────────────────────────────
const CBS_NODES = [
  { code: '1', name: 'Bridge Works' },
  { code: '1.1', name: 'Foundation' },
  { code: '1.2', name: 'Substructure' },
  { code: '1.3', name: 'Superstructure' },
  { code: '2', name: 'Road Works' },
  { code: '2.1', name: 'Earthwork' },
  { code: '2.2', name: 'Pavement' },
  { code: '2.3', name: 'Signage & Markings' },
  { code: '3', name: 'Drainage' },
]

// ─── Build the search index ──────────────────────────────────────────────────
export function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = []

  // Modules
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

  // BOQ items
  for (const b of BOQ_ITEMS) {
    results.push({
      id: `boq-${b.code}`,
      title: b.desc,
      subtitle: `BOQ ${b.code} · ${b.qty} ${b.uom}`,
      type: 'BOQ Item',
      module: 'boq',
      icon: 'Calculator',
      keywords: `${b.code} ${b.desc} ${b.uom} boq`.toLowerCase(),
    })
  }

  // Schedule tasks
  for (const t of SCHEDULE_TASKS) {
    results.push({
      id: `task-${t.id}`,
      title: t.name,
      subtitle: `Task ${t.id} · Schedule`,
      type: 'Task',
      module: 'scheduler',
      icon: 'GanttChart',
      keywords: `${t.id} ${t.name} schedule task`.toLowerCase(),
    })
  }

  // Drawings
  for (const d of DRAWINGS) {
    results.push({
      id: `dwg-${d.number}`,
      title: d.title,
      subtitle: `Drawing ${d.number} · Rev ${d.rev}`,
      type: 'Drawing',
      module: 'drawings',
      icon: 'FileStack',
      keywords: `${d.number} ${d.title} drawing rev ${d.rev}`.toLowerCase(),
    })
  }

  // Letters
  for (const l of LETTERS) {
    results.push({
      id: `letter-${l.number}`,
      title: l.subject,
      subtitle: `Letter ${l.number} · Correspondence`,
      type: 'Letter',
      module: 'correspondence',
      icon: 'Mail',
      keywords: `${l.number} ${l.subject} letter correspondence`.toLowerCase(),
    })
  }

  // Q&S items
  for (const q of QS_ITEMS) {
    results.push({
      id: `qs-${q.id}`,
      title: q.title,
      subtitle: `${q.id} · Quality & Safety`,
      type: 'Q&S Item',
      module: 'qs',
      icon: 'ShieldCheck',
      keywords: `${q.id} ${q.title} quality safety ncr itr punch incident`.toLowerCase(),
    })
  }

  // Equipment
  for (const e of EQUIPMENT) {
    results.push({
      id: `equip-${e.id}`,
      title: e.name,
      subtitle: `${e.id} · Equipment`,
      type: 'Equipment',
      module: 'equipment',
      icon: 'Truck',
      keywords: `${e.id} ${e.name} equipment fleet`.toLowerCase(),
    })
  }

  // Workers
  for (const w of WORKERS) {
    results.push({
      id: `worker-${w.id}`,
      title: w.name,
      subtitle: `${w.id} · ${w.trade}`,
      type: 'Worker',
      module: 'time-attendance',
      icon: 'Fingerprint',
      keywords: `${w.id} ${w.name} ${w.trade} worker`.toLowerCase(),
    })
  }

  // Requisitions
  for (const r of REQUISITIONS) {
    results.push({
      id: `req-${r.id}`,
      title: r.item,
      subtitle: `${r.id} · Procurement`,
      type: 'Requisition',
      module: 'procurement',
      icon: 'PackageSearch',
      keywords: `${r.id} ${r.item} requisition procurement`.toLowerCase(),
    })
  }

  // Subcontractors
  for (const s of SUBCONTRACTORS) {
    results.push({
      id: `sc-${s.id}`,
      title: s.name,
      subtitle: `${s.id} · ${s.scope}`,
      type: 'Subcontractor',
      module: 'subcontractor',
      icon: 'Users',
      keywords: `${s.id} ${s.name} ${s.scope} subcontractor`.toLowerCase(),
    })
  }

  // CBS nodes
  for (const c of CBS_NODES) {
    results.push({
      id: `cbs-${c.code}`,
      title: c.name,
      subtitle: `CBS ${c.code} · Financials`,
      type: 'CBS Node',
      module: 'financials',
      icon: 'Landmark',
      keywords: `${c.code} ${c.name} cbs financials`.toLowerCase(),
    })
  }

  return results
}

// Search the index — returns results sorted by relevance (simple includes match)
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
