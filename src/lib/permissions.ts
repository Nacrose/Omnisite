/**
 * Role-based permission system for OmniSite.
 *
 * Roles (Nepali construction project hierarchy):
 *  - PM              : Project Manager — full access, all edits (admin/financials included)
 *  - SITE_ENGINEER   : Site Engineer — full read access; cannot edit Admin or Financials
 *  - STOREKEEPER     : Storekeeper — Procurement + DSR only (read-only elsewhere)
 *  - FOREMAN         : Foreman — DSR + Time & Attendance only (read-only elsewhere)
 *
 * The matrix below is the source of truth. Modules not listed for a role
 * are still VISIBLE (so the foreman can read the schedule) but not EDITABLE.
 */

import type { ModuleId } from '@/lib/app-store'

export type Role = 'PM' | 'SITE_ENGINEER' | 'STOREKEEPER' | 'FOREMAN'

export interface RoleTemplate {
  id: Role
  label: string
  description: string
  /** Modules this role can open / see in the nav rail. */
  visibleModules: ModuleId[] | 'ALL'
  /** Modules this role can edit (create / update / delete) within. */
  editableModules: ModuleId[]
}

export const ROLE_TEMPLATES: Record<Role, RoleTemplate> = {
  PM: {
    id: 'PM',
    label: 'Project Manager',
    description: 'Full access — all modules, all edits, admin & financials included.',
    visibleModules: 'ALL',
    editableModules: [
      'dashboard',
      'boq',
      'scheduler',
      'daily-ops',
      'equipment',
      'procurement',
      'financials',
      'vendors',
      'drawings',
      'correspondence',
      'admin',
      'reports',
      'qs',
      'time-attendance',
      'chat',
    ],
  },
  SITE_ENGINEER: {
    id: 'SITE_ENGINEER',
    label: 'Site Engineer',
    description: 'Full read access; cannot edit Admin or Financials.',
    visibleModules: 'ALL',
    editableModules: [
      'dashboard',
      'boq',
      'scheduler',
      'daily-ops',
      'equipment',
      'procurement',
      'vendors',
      'drawings',
      'correspondence',
      'reports',
      'qs',
      'time-attendance',
      'chat',
    ],
  },
  STOREKEEPER: {
    id: 'STOREKEEPER',
    label: 'Storekeeper',
    description: 'Procurement + DSR only; read-only elsewhere.',
    visibleModules: ['dashboard', 'daily-ops', 'procurement', 'reports', 'chat'],
    editableModules: ['daily-ops', 'procurement'],
  },
  FOREMAN: {
    id: 'FOREMAN',
    label: 'Foreman',
    description: 'DSR + Time & Attendance only; read-only elsewhere.',
    visibleModules: ['dashboard', 'daily-ops', 'time-attendance', 'chat'],
    editableModules: ['daily-ops', 'time-attendance'],
  },
}

/**
 * Whether a user with the given role can ACCESS (open / view) a module.
 * Returns true for PM/SITE_ENGINEER on any module; for others, checks the matrix.
 */
export function canAccess(module: ModuleId, role: Role): boolean {
  const tpl = ROLE_TEMPLATES[role]
  if (!tpl) return false
  if (tpl.visibleModules === 'ALL') return true
  return tpl.visibleModules.includes(module)
}

/**
 * Whether a user with the given role can EDIT (create / update / delete) within a module.
 * Use this to gate Save / Submit / Delete buttons in module UIs.
 */
export function canEdit(module: ModuleId, role: Role): boolean {
  const tpl = ROLE_TEMPLATES[role]
  if (!tpl) return false
  return tpl.editableModules.includes(module)
}

/**
 * Returns a human-readable reason string when access is denied.
 * Useful for tooltip / aria-describedby on disabled buttons.
 */
export function accessDeniedReason(module: ModuleId, role: Role): string | null {
  if (canEdit(module, role)) return null
  if (canAccess(module, role)) {
    return `Read-only — ${ROLE_TEMPLATES[role].label} role cannot edit ${module}`
  }
  return `${ROLE_TEMPLATES[role].label} role does not have access to ${module}`
}
