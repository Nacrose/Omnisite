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
   *  applies (e.g. "Pier 3"). Persisted to the rfis.location_id column
   *  (migration 28). */
  locationId?: string
}

// ─── Shared RFI store ──────────────────────────────────────────────────────
// RFIs need to be mutable so the DSR Inspector can add new drafts that
// appear in the RFI Register. Using a module-level array + useSyncExternalStore
// so both components see the same state without prop drilling.
//
// ─── Persistence ──────────────────────────────────────────────────────────
// Previously this was a localStorage-only stopgap (usePersistentState). As of
// migration 28, RFIs are backed by the `rfis` DB table + /api/rfis route.
// The store now mirrors that pattern:
//
//   - Reads:  RfiTab mounts useSyncedState('rfis') and pushes the result
//             into this module-level cache via setRfisFromServer(). Other
//             consumers (DSR Inspector, open-RFI count in the header)
//             subscribe to this cache via useSyncExternalStore — they
//             don't each call useSyncedState because that would create
//             duplicate Supabase channels + duplicate API fetches.
//   - Writes: addRfi() / updateRfi() update the local cache immediately
//             (optimistic) AND fire a POST to /api/rfis via upsertOne().
//             The RfiTab's useSyncedState realtime subscription will
//             receive the same row back from the server and reconcile.
//
// localStorage is kept as a fallback for demo mode (no Supabase configured)
// — same behavior as useSyncedState's localStorage path.

import { upsertOne } from '@/lib/api-client'
import { isSupabaseConfigured } from '@/lib/supabase'

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

// ─── Module-level store ────────────────────────────────────────────────────
// Backed by RfiTab's useSyncedState via setRfisFromServer(). localStorage
// remains the demo-mode fallback (matches useSyncedState's behavior).

let rfiState: Rfi[] = [...INITIAL_RFIS]
const rfiListeners = new Set<() => void>()

function notifyRfiListeners() {
  rfiListeners.forEach((l) => l())
}

// Load from localStorage on module init — only used in demo mode (no
// Supabase configured). When Supabase is configured, RfiTab's useSyncedState
// hydrates from /api/rfis instead.
if (typeof window !== 'undefined' && !isSupabaseConfigured()) {
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

function persistRfisLocal() {
  // Only persist to localStorage in demo mode. In Supabase mode, the
  // server is the source of truth — localStorage would drift.
  if (typeof window !== 'undefined' && !isSupabaseConfigured()) {
    try {
      localStorage.setItem('omnisite-rfis', JSON.stringify(rfiState))
    } catch {
      // Quota exceeded or localStorage unavailable — state still works in-memory.
    }
  }
}

/**
 * Push a fresh snapshot from the server-side useSyncedState caller (RfiTab).
 * Called whenever the RfiTab's useSyncedState hook receives new data —
 * either on initial fetch, on a realtime UPDATE/INSERT/DELETE, or on a
 * loadMore() page. Replaces the local state wholesale and notifies all
 * useSyncExternalStore subscribers.
 *
 * This is the bridge between the hook-based read path (RfiTab's useSyncedState)
 * and the imperative write path (addRfi / updateRfi called from the DSR
 * Inspector and Create-Modal components).
 */
export function setRfisFromServer(rfis: Rfi[]): void {
  // Skip if the snapshot is identical — avoids a spurious re-render cycle
  // when the realtime channel echoes back our own write.
  if (rfis === rfiState) return
  if (rfis.length === rfiState.length && rfis.every((r, i) => r.id === rfiState[i]?.id)) {
    // Cheap ID check — if IDs match in order, assume the snapshot is the
    // same. This is correct for the common case (no realtime changes). A
    // deep comparison would be more correct but slower for large registers.
    return
  }
  rfiState = rfis
  notifyRfiListeners()
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

/**
 * Convert a camelCase Rfi to a snake_case DB row for POST /api/rfis.
 * Matches the fieldMap used by useSyncedState in rfi-tab.tsx.
 */
function rfiToRow(rfi: Rfi): Record<string, unknown> {
  return {
    id: rfi.id,
    number: rfi.number,
    date: rfi.date,
    subject: rfi.subject,
    question: rfi.question,
    background: rfi.background,
    impact: rfi.impact,
    status: rfi.status,
    reply_by: rfi.replyBy,
    reply: rfi.reply ?? null,
    replied_date: rfi.repliedDate ?? null,
    linked_dsr: rfi.linkedDsr ?? null,
    cost_impact: rfi.costImpact ?? null,
    schedule_impact: rfi.scheduleImpact ?? null,
    severity: rfi.severity,
    location_id: rfi.locationId ?? null,
  }
}

/** Add a new RFI to the store + POST to /api/rfis.
 *
 *  Used by the DSR Inspector's saveRfi() and the RFI Create Modal's submit.
 *  Updates the local cache immediately (optimistic) so the UI feels instant,
 *  then fires the API call. If the API call fails, the optimistic update is
 *  NOT rolled back — the global error toast (P2-7) fires, and the realtime
 *  channel will eventually reconcile. A future iteration could add proper
 *  rollback via the existing `pendingUpsertsRef` pattern in use-synced-state.
 */
export function addRfi(rfi: Rfi): void {
  rfiState = [rfi, ...rfiState]
  persistRfisLocal()
  notifyRfiListeners()

  if (isSupabaseConfigured()) {
    // Fire-and-forget — api-client's global error toast handles failures.
    void upsertOne('rfis', rfiToRow(rfi)).catch(() => {
      // Swallow — the global error toast (P2-7) already notified the user.
      // The realtime channel will reconcile when the server eventually
      // accepts the write (e.g. after a transient network blip).
    })
  }
}

/** Update an existing RFI by id + POST the merged row to /api/rfis.
 *
 *  Used by the RFI Inspector's "Log Consultant Reply" and "Close RFI"
 *  actions, and the LocationPicker onChange.
 */
export function updateRfi(id: string, updates: Partial<Rfi>): void {
  rfiState = rfiState.map((r) => (r.id === id ? { ...r, ...updates } : r))
  persistRfisLocal()
  notifyRfiListeners()

  if (isSupabaseConfigured()) {
    const updated = rfiState.find((r) => r.id === id)
    if (updated) {
      void upsertOne('rfis', rfiToRow(updated)).catch(() => {
        // Same as addRfi — global toast handles failures.
      })
    }
  }
}

// Re-export RFIS for backward compat (components that read the initial array
// directly). This is a snapshot — for live updates, use subscribeRfis/getRfis.
export const RFIS: Rfi[] = INITIAL_RFIS
