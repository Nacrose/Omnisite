/**
 * Granular permission registry.
 */

export interface PermissionDef {
  key: string
  label: string
  description: string
  default: boolean
}

export const PERMISSIONS: PermissionDef[] = [
  {
    key: 'boq.viewRates',
    label: 'View Rates',
    description: 'See Rate/Amount columns. Off = hidden.',
    default: true,
  },
  {
    key: 'boq.editRates',
    label: 'Edit Rates',
    description: 'Edit BOQ item rates. Off = read-only.',
    default: true,
  },
  {
    key: 'boq.exportRa',
    label: 'Export RA',
    description: 'Export Rate Analysis CSV.',
    default: true,
  },
  {
    key: 'boq.exportCsv',
    label: 'Export BOQ CSV',
    description: 'Export full BOQ as CSV.',
    default: true,
  },
  {
    key: 'fin.viewCBS',
    label: 'View CBS',
    description: 'See Cost Breakdown Structure.',
    default: true,
  },
  {
    key: 'fin.viewDailyExpense',
    label: 'View Daily Expenses',
    description: 'See daily expense register.',
    default: true,
  },
  {
    key: 'fin.viewCashFlow',
    label: 'View Cash Flow',
    description: 'See cash flow chart.',
    default: true,
  },
  {
    key: 'fin.editBudget',
    label: 'Edit Budget',
    description: 'Edit CBS budget values.',
    default: false,
  },
  {
    key: 'proc.createPo',
    label: 'Create POs',
    description: 'Create Purchase Orders.',
    default: true,
  },
  {
    key: 'proc.approveGrn',
    label: 'Approve GRNs',
    description: 'Approve GRNs (releases payment).',
    default: false,
  },
  {
    key: 'proc.viewRates',
    label: 'View PO Rates',
    description: 'See PO line-item rates.',
    default: true,
  },
  {
    key: 'sched.editDependencies',
    label: 'Edit Dependencies',
    description: 'Add/remove task links.',
    default: true,
  },
  {
    key: 'sched.levelResources',
    label: 'Level Resources',
    description: 'Run resource leveling.',
    default: false,
  },
  {
    key: 'sched.editBaseline',
    label: 'Edit Baselines',
    description: 'Edit task baseline dates.',
    default: false,
  },
  {
    key: 'dailyops.createRfi',
    label: 'Create RFIs',
    description: 'Create RFIs from DSR.',
    default: true,
  },
  {
    key: 'dailyops.editDsr',
    label: 'Edit DSR',
    description: 'Edit Daily Site Reports.',
    default: true,
  },
  {
    key: 'vendors.viewCompliance',
    label: 'View Compliance',
    description: 'Vendor compliance dashboard.',
    default: true,
  },
  {
    key: 'vendors.viewRunningBills',
    label: 'View Running Bills',
    description: 'SC running bills.',
    default: false,
  },
  {
    key: 'admin.manageUsers',
    label: 'Manage Users',
    description: 'Invite/remove users, edit perms.',
    default: false,
  },
  {
    key: 'admin.editMaterials',
    label: 'Edit Materials',
    description: 'Edit material master.',
    default: false,
  },
  {
    key: 'admin.editRates',
    label: 'Edit Rate Library',
    description: 'Edit rate library.',
    default: false,
  },
  {
    key: 'drawings.annotate',
    label: 'Annotate Drawings',
    description: 'Add PDF markups.',
    default: true,
  },
]

export function getPermissionGroups() {
  const groups: Record<string, PermissionDef[]> = {}
  for (const p of PERMISSIONS) {
    const mod = p.key.split('.')[0]
    if (!groups[mod]) groups[mod] = []
    groups[mod].push(p)
  }
  return groups
}

export const MODULE_LABELS: Record<string, string> = {
  boq: 'BOQ & Rate Analysis',
  fin: 'Financials',
  proc: 'Procurement',
  sched: 'Scheduler',
  dailyops: 'Daily Operations',
  vendors: 'Vendors',
  admin: 'Admin',
  drawings: 'Drawings',
}

export type Permissions = Record<string, boolean>

export function resolvePermission(perms: Permissions | null | undefined, key: string): boolean {
  if (perms && key in perms) return perms[key]
  return PERMISSIONS.find((p) => p.key === key)?.default ?? true
}
