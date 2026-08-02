// ─── Q&S module types & seed data ─────────────────────────────────────────
// Extracted from the monolithic qs.tsx so the inspector / registers panes
// can import a single source of truth for the QsItem shape, the NCR
// workflow state machine, and the seed rows used to bootstrap the local
// register before Supabase is reachable.

export type QsItemType = 'ITR' | 'NCR' | 'Punch' | 'Incident' | 'Near-Miss'

export type QsItemStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'Closed'
  | 'Open'
  | 'CAP Submitted'
  | 'Consultant Sign-off'

export type QsSeverity = 'low' | 'medium' | 'high'

export interface QsCap {
  rootCause: string
  action: string
  assignee: string
  dueDate: string
}

export interface QsItem {
  id: string
  type: QsItemType
  title: string
  linkedBoq?: string
  status: QsItemStatus
  date: string
  assignee?: string
  dueDate?: string
  severity?: QsSeverity
  billingHold?: boolean
  cap?: QsCap
  /** Optional FK to project_locations.id — where the issue was identified.
   *  Stored in local state for now; the DB column will land in a follow-up
   *  migration. */
  locationId?: string
}

/** Filter chips shown in the left pane (All + one per register type). */
export const QS_FILTERS = ['All', 'ITR', 'NCR', 'Punch', 'Incident', 'Near-Miss'] as const
export type QsFilter = (typeof QS_FILTERS)[number]

// NCR workflow: Open → CAP Submitted → Consultant Sign-off → Closed
export const NCR_WORKFLOW: Record<string, string | null> = {
  Open: 'CAP Submitted',
  'CAP Submitted': 'Consultant Sign-off',
  'Consultant Sign-off': 'Closed',
  Closed: null,
}

/** Ordered list of NCR workflow steps — used by the inspector's stepper UI. */
export const NCR_WORKFLOW_STEPS = ['Open', 'CAP Submitted', 'Consultant Sign-off', 'Closed']

export const INITIAL_ITEMS: QsItem[] = [
  {
    id: 'ITR-042',
    type: 'ITR',
    title: 'PCC M15 — footing at ch. 4+200 to 4+350',
    linkedBoq: '1.1.3',
    status: 'Submitted',
    date: '30 Jul 2026',
    assignee: 'Er. Suresh (Consultant)',
  },
  {
    id: 'ITR-041',
    type: 'ITR',
    title: 'Stone soling at pier P-4',
    linkedBoq: '1.1.2',
    status: 'Approved',
    date: '29 Jul 2026',
  },
  {
    id: 'NCR-034',
    type: 'NCR',
    title: 'Rebar cover < 40mm at box culvert base slab',
    linkedBoq: '3.2',
    status: 'Open',
    date: '28 Jul 2026',
    assignee: 'Bikash Rai',
    dueDate: '05 Aug 2026',
    severity: 'high',
    billingHold: true,
  },
  {
    id: 'NCR-033',
    type: 'NCR',
    title: 'Honeycombing in PCC at ch. 4+050',
    linkedBoq: '1.1.4',
    status: 'Closed',
    date: '20 Jul 2026',
  },
  {
    id: 'PCH-018',
    type: 'Punch',
    title: 'Smooth edges at expansion joint',
    status: 'Open',
    date: '27 Jul 2026',
    assignee: 'Foreman Ram',
    dueDate: '15 Aug 2026',
    severity: 'low',
  },
  {
    id: 'PCH-017',
    type: 'Punch',
    title: 'Clean debris from drainage outlet',
    status: 'Closed',
    date: '22 Jul 2026',
  },
  {
    id: 'INC-005',
    type: 'Incident',
    title: 'Worker minor cut at rebar yard',
    status: 'Closed',
    date: '25 Jul 2026',
    severity: 'low',
  },
  {
    id: 'NM-012',
    type: 'Near-Miss',
    title: 'Tipper reversing without spotter',
    status: 'Open',
    date: '28 Jul 2026',
    severity: 'medium',
  },
]
