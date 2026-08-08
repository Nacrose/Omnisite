/**
 * Role-based permission system for OmniSite.
 *
 * Role hierarchy (top-down):
 *  - SUPER_ADMIN      : Organization owner — full control, creates Admins, manages org
 *  - ADMIN            : Organization admin — creates projects, assigns PMs, manages users
 *  - PM               : Project Manager — full access to assigned project (all modules)
 *  - SITE_ENGINEER    : Site Engineer — all modules except Admin & Financials (read-only there)
 *  - STOREKEEPER      : Storekeeper — Procurement + DSR only
 *  - FOREMAN          : Foreman — DSR + Time & Attendance only
 *
 * Assignment chain:
 *   Super Admin → creates Admins
 *   Admin → creates projects + assigns PMs
 *   PM → invites Site Engineers / Storekeepers / Foremen to their project
 *
 * The first user to sign up becomes Super Admin via the /onboarding wizard.
 * Subsequent users are created/invited by the appropriate role above.
 */

import type { ModuleId } from '@/lib/app-store'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'PM' | 'SITE_ENGINEER' | 'STOREKEEPER' | 'FOREMAN'

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
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Organization owner — full control, creates Admins, manages org settings.',
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
  ADMIN: {
    id: 'ADMIN',
    label: 'Admin',
    description: 'Creates projects, assigns PMs, manages users. Full module access.',
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
  PM: {
    id: 'PM',
    label: 'Project Manager',
    description: 'Full access to assigned project — all modules, all edits.',
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
 * Returns true for SUPER_ADMIN/ADMIN/PM/SITE_ENGINEER on any module;
 * for others, checks the matrix.
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
