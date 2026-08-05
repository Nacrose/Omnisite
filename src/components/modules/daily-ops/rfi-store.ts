'use client'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Rfi {
  id: string
  number: string
  date: string
  subject: string
  question: string
  background: string
  impact: string
  status: 'Open' | 'Replied' | 'Closed'
  replyBy: string
  reply?: string
  repliedDate?: string
  linkedDsr?: string
  costImpact?: string
  scheduleImpact?: string
  severity: 'low' | 'medium' | 'high'
  /** Optional FK to project_locations.id — where the question physically
   *  applies (e.g. "Pier 3"). Persisted to localStorage alongside the
   *  RFI record. NOT yet backed by a DB table — see the persistence
   *  comment above (audit round 11). */
  locationId?: string
}

// ─── Shared RFI store ──────────────────────────────────────────────────────
// RFIs need to be mutable so the DSR Inspector can add new drafts that
// appear in the RFI Register. Using a module-level array + useSyncExternalStore
// so both components see the same state without prop drilling.
const INITIAL_RFIS: Rfi[] = [
  {
    id: 'r1',
    number: 'RFI-067',
    date: '22 Jul 2026',
    subject: 'Rebar detailing at expansion joint — chainage 4+200',
    question:
      'The contract drawings show lap splices of 40φ at the expansion joint, but the special detailing note on Sheet KRR-P3-DR-DR-008 Rev A calls for mechanical couplers in this zone. Please clarify which applies — and if couplers, what type (Type 1 vs Type 2 per ASTM A1035).',
    background:
      'DSR Entry D-087 — Foundation PCC at chainage 4+200 to 4+350. Rebar fabrication is scheduled to start 02 Aug 2026. The rebar shop drawings cannot be finalized until this is resolved.',
    impact:
      'Schedule: ~3 days of float on T-203 (Foundation). If delayed beyond 02 Aug, the critical path slips and the Substructure milestone (T-404, Wk 48) is at risk. Cost: couplers add ~NPR 850/ea × ~120 locations = NPR 102,000 if required.',
    status: 'Open',
    replyBy: '26 Jul 2026',
    linkedDsr: 'D-087',
    costImpact: 'NPR 102,000 (potential)',
    scheduleImpact: '3 days float on T-203',
    severity: 'high',
  },
  {
    id: 'r2',
    number: 'RFI-066',
    date: '20 Jul 2026',
    subject: 'Concrete cover for pile caps in aggressive soil zone',
    question:
      'The geotechnical report flags sulphate exposure (Class 2) at chainage 3+100 to 3+400. The BOQ specifies 50mm cover for pile caps, but IS 456:2000 Table 4 recommends 75mm for Class 2 exposure. Which applies?',
    background:
      'Pile cap pour for Section 2 is scheduled for 05 Aug 2026. ~42 pile caps affected across the chainage range.',
    impact:
      'Cost: +25mm cover × 42 caps × nominal rebar increase ≈ NPR 145,000. No schedule impact — rebar already on site can be adjusted.',
    status: 'Replied',
    replyBy: '24 Jul 2026',
    reply:
      'Engineer confirms 75mm cover required per IS 456:2000 for Class 2 sulphate exposure. Additional cost treated as a Variation Order per FIDIC Clause 13. Please submit BOQ adjustment via the Variation Order module.',
    repliedDate: '24 Jul 2026',
    linkedDsr: 'D-085',
    costImpact: 'NPR 145,000 (confirmed → VO)',
    scheduleImpact: 'None',
    severity: 'medium',
  },
  {
    id: 'r3',
    number: 'RFI-065',
    date: '15 Jul 2026',
    subject: 'Drainage outlet invert levels at chainage 2+100',
    question:
      'The road profile drawing (KRR-P3-RD-PR-003) and the drainage drawing (KRR-P3-DR-DN-012) show conflicting invert levels for the outlet at ch. 2+100 (RL 1184.50 vs RL 1184.20). Which is correct?',
    background:
      'Drainage works at ch. 2+050 to 2+200 are underway. The excavation was paused at the outlet location pending clarification.',
    impact:
      'Schedule: 1 day of rework if the wrong invert is cast. Cost: ~NPR 18,000 for rework if needed.',
    status: 'Closed',
    replyBy: '18 Jul 2026',
    reply:
      'Engineer confirms RL 1184.20 (drainage drawing governs). Road profile will be revised in Rev B. No rework required as excavation was paused.',
    repliedDate: '17 Jul 2026',
    linkedDsr: 'D-079',
    costImpact: 'None',
    scheduleImpact: '1 day saved (no rework)',
    severity: 'low',
  },
  {
    id: 'r4',
    number: 'RFI-068',
    date: '29 Jul 2026',
    subject: 'Shotcrete thickness tolerance for tunnel support',
    question:
      'The tunnel support drawing specifies 50mm nominal shotcrete with a +10/-0mm tolerance. At chainage 0+380 the rock face is irregular by up to 25mm. Do we apply min 50mm over the highest point, or over the nominal line?',
    background:
      'Tunnel face advance at ch. 0+380. The geological face log shows rock class III with local overbreak. Shotcrete application is scheduled for today.',
    impact:
      'Quantity: +15% shotcrete consumption if applying over the highest point = ~0.4 cum extra per linear meter × ~12m affected = NPR 21,000. No schedule impact.',
    status: 'Open',
    replyBy: '31 Jul 2026',
    linkedDsr: 'D-092',
    costImpact: 'NPR 21,000 (potential)',
    scheduleImpact: 'None',
    severity: 'medium',
  },
]

// ─── RFI persistence ────────────────────────────────────────────────────────
// RFIs are persisted via usePersistentState (localStorage) so they survive
// page reloads. This is a stopgap — the proper solution is a dedicated
// `rfis` DB table + API route + useSyncedState wiring, matching how
// dsr_entries, qs_items, and letters are persisted. Until that table
// exists, usePersistentState gives us cross-reload persistence which the
// previous Zustand store did not (reload = back to seed data only).
//
// The store uses a module-level state + useSyncExternalStore pattern so
// the DSR Inspector (which lives in a different component tree) can add
// RFIs that immediately appear in the RFI Register without prop drilling.

let rfiState: Rfi[] = [...INITIAL_RFIS]
const rfiListeners = new Set<() => void>()

function notifyRfiListeners() {
  rfiListeners.forEach((l) => l())
}

// Load from localStorage on module init.
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('omnisite-rfis')
    if (stored) {
      const parsed = JSON.parse(stored) as Rfi[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        rfiState = parsed
      }
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode) — fall back to seed.
  }
}

function persistRfis() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('omnisite-rfis', JSON.stringify(rfiState))
    } catch {
      // Quota exceeded or localStorage unavailable — state still works in-memory.
    }
  }
}

/**
 * Subscribe to RFI store changes (for useSyncExternalStore callers).
 */
export function subscribeRfis(listener: () => void): () => void {
  rfiListeners.add(listener)
  return () => rfiListeners.delete(listener)
}

/** Get the current RFI snapshot. */
export function getRfis(): Rfi[] {
  return rfiState
}

/** Add a new RFI to the store. Used by the DSR Inspector's saveRfi(). */
export function addRfi(rfi: Rfi): void {
  rfiState = [rfi, ...rfiState]
  persistRfis()
  notifyRfiListeners()
}

/** Update an existing RFI by id. Used by the RFI Inspector's "Log Consultant
 *  Reply" action (audit D2-7). */
export function updateRfi(id: string, updates: Partial<Rfi>): void {
  rfiState = rfiState.map((r) => (r.id === id ? { ...r, ...updates } : r))
  persistRfis()
  notifyRfiListeners()
}

// Re-export RFIS for backward compat (components that read the initial array
// directly). This is a snapshot — for live updates, use subscribeRfis/getRfis.
export const RFIS: Rfi[] = INITIAL_RFIS
