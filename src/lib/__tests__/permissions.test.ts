import { describe, it, expect } from 'vitest'
import {
  canAccess,
  canEdit,
  accessDeniedReason,
  ROLE_TEMPLATES,
  type Role,
} from '@/lib/permissions'
import type { ModuleId } from '@/lib/app-store'

// ─── canAccess ──────────────────────────────────────────────────────────────

describe('canAccess', () => {
  it('PM can access every module', () => {
    // PM has visibleModules: 'ALL'.
    const modules: ModuleId[] = [
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
    ]
    for (const m of modules) {
      expect(canAccess(m, 'PM')).toBe(true)
    }
  })

  it('SITE_ENGINEER can access every module (visibleModules: ALL)', () => {
    expect(canAccess('financials', 'SITE_ENGINEER')).toBe(true)
    expect(canAccess('admin', 'SITE_ENGINEER')).toBe(true)
    expect(canAccess('boq', 'SITE_ENGINEER')).toBe(true)
  })

  it('STOREKEEPER can only access the modules in their visibleModules list', () => {
    expect(canAccess('dashboard', 'STOREKEEPER')).toBe(true)
    expect(canAccess('daily-ops', 'STOREKEEPER')).toBe(true)
    expect(canAccess('procurement', 'STOREKEEPER')).toBe(true)
    expect(canAccess('reports', 'STOREKEEPER')).toBe(true)
    expect(canAccess('chat', 'STOREKEEPER')).toBe(true)
    // Cannot see these:
    expect(canAccess('boq', 'STOREKEEPER')).toBe(false)
    expect(canAccess('financials', 'STOREKEEPER')).toBe(false)
    expect(canAccess('admin', 'STOREKEEPER')).toBe(false)
  })

  it('FOREMAN can only see DSR + Time & Attendance + dashboard + chat', () => {
    expect(canAccess('dashboard', 'FOREMAN')).toBe(true)
    expect(canAccess('daily-ops', 'FOREMAN')).toBe(true)
    expect(canAccess('time-attendance', 'FOREMAN')).toBe(true)
    expect(canAccess('chat', 'FOREMAN')).toBe(true)
    expect(canAccess('boq', 'FOREMAN')).toBe(false)
    expect(canAccess('procurement', 'FOREMAN')).toBe(false)
    expect(canAccess('financials', 'FOREMAN')).toBe(false)
  })
})

// ─── canEdit ────────────────────────────────────────────────────────────────

describe('canEdit', () => {
  it('PM can edit every module', () => {
    expect(canEdit('financials', 'PM')).toBe(true)
    expect(canEdit('admin', 'PM')).toBe(true)
    expect(canEdit('boq', 'PM')).toBe(true)
    expect(canEdit('chat', 'PM')).toBe(true)
  })

  it('SITE_ENGINEER can edit everything except Admin + Financials', () => {
    expect(canEdit('boq', 'SITE_ENGINEER')).toBe(true)
    expect(canEdit('scheduler', 'SITE_ENGINEER')).toBe(true)
    expect(canEdit('procurement', 'SITE_ENGINEER')).toBe(true)
    expect(canEdit('admin', 'SITE_ENGINEER')).toBe(false)
    expect(canEdit('financials', 'SITE_ENGINEER')).toBe(false)
  })

  it('STOREKEEPER can only edit Procurement + DSR', () => {
    expect(canEdit('procurement', 'STOREKEEPER')).toBe(true)
    expect(canEdit('daily-ops', 'STOREKEEPER')).toBe(true)
    // Cannot edit:
    expect(canEdit('boq', 'STOREKEEPER')).toBe(false)
    expect(canEdit('financials', 'STOREKEEPER')).toBe(false)
    expect(canEdit('admin', 'STOREKEEPER')).toBe(false)
    // Can see reports/chat but not edit:
    expect(canEdit('reports', 'STOREKEEPER')).toBe(false)
    expect(canEdit('chat', 'STOREKEEPER')).toBe(false)
  })

  it('FOREMAN can only edit DSR + Time & Attendance', () => {
    expect(canEdit('daily-ops', 'FOREMAN')).toBe(true)
    expect(canEdit('time-attendance', 'FOREMAN')).toBe(true)
    expect(canEdit('procurement', 'FOREMAN')).toBe(false)
    expect(canEdit('boq', 'FOREMAN')).toBe(false)
    expect(canEdit('chat', 'FOREMAN')).toBe(false)
  })
})

// ─── accessDeniedReason ─────────────────────────────────────────────────────

describe('accessDeniedReason', () => {
  it('returns null when the user can edit', () => {
    expect(accessDeniedReason('boq', 'PM')).toBeNull()
    expect(accessDeniedReason('daily-ops', 'FOREMAN')).toBeNull()
  })

  it('returns a read-only reason when the user can access but not edit', () => {
    const reason = accessDeniedReason('boq', 'FOREMAN')
    // FOREMAN can't see boq, so this should NOT be read-only.
    expect(reason).not.toBeNull()
    expect(reason).toContain('does not have access')
  })

  it('returns a read-only reason for STOREKEEPER on reports (visible, not editable)', () => {
    const reason = accessDeniedReason('reports', 'STOREKEEPER')
    expect(reason).not.toBeNull()
    expect(reason).toContain('Read-only')
    expect(reason).toContain('reports')
  })

  it('returns a no-access reason when the user cannot even see the module', () => {
    const reason = accessDeniedReason('admin', 'FOREMAN')
    expect(reason).not.toBeNull()
    expect(reason).toContain('does not have access')
    expect(reason).toContain('admin')
  })

  it('reason string includes the human-readable role label', () => {
    const reason = accessDeniedReason('financials', 'SITE_ENGINEER')
    expect(reason).not.toBeNull()
    expect(reason).toContain('Site Engineer')
  })
})

// ─── ROLE_TEMPLATES consistency ────────────────────────────────────────────

describe('ROLE_TEMPLATES consistency', () => {
  const roles: Role[] = ['PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN']

  it('every editable module is also visible', () => {
    // Invariant: a user can never edit a module they can't see. If we ever
    // add a module to editableModules but forget to add it to visibleModules
    // (or to the 'ALL' fallback), this catches it.
    for (const role of roles) {
      const tpl = ROLE_TEMPLATES[role]
      const visible =
        tpl.visibleModules === 'ALL'
          ? null // ALL — every editable is implicitly visible
          : new Set(tpl.visibleModules)
      for (const editable of tpl.editableModules) {
        if (visible) {
          expect(
            visible.has(editable),
            `${role}: module "${editable}" is editable but not visible`
          ).toBe(true)
        }
      }
    }
  })

  it('every role template has a non-empty label and description', () => {
    for (const role of roles) {
      const tpl = ROLE_TEMPLATES[role]
      expect(tpl.label.length).toBeGreaterThan(0)
      expect(tpl.description.length).toBeGreaterThan(0)
      expect(tpl.id).toBe(role)
    }
  })

  it('PM has visibleModules = ALL and the widest editableModules set', () => {
    expect(ROLE_TEMPLATES.PM.visibleModules).toBe('ALL')
    const pmCount = ROLE_TEMPLATES.PM.editableModules.length
    for (const role of roles) {
      if (role === 'PM') continue
      expect(ROLE_TEMPLATES[role].editableModules.length).toBeLessThanOrEqual(pmCount)
    }
  })

  it('every PM-editable module is also editable by SITE_ENGINEER, except Admin + Financials', () => {
    // Documents the role split: PM and SITE_ENGINEER share the operational
    // modules; Admin + Financials are PM-only.
    const pm = new Set(ROLE_TEMPLATES.PM.editableModules)
    const se = new Set(ROLE_TEMPLATES.SITE_ENGINEER.editableModules)
    for (const m of pm) {
      if (m === 'admin' || m === 'financials') {
        expect(se.has(m), `SITE_ENGINEER should NOT be able to edit ${m}`).toBe(false)
      } else {
        expect(se.has(m), `SITE_ENGINEER should be able to edit ${m}`).toBe(true)
      }
    }
  })

  it('FOREMAN and STOREKEEPER have restricted visibleModules lists (not ALL)', () => {
    expect(Array.isArray(ROLE_TEMPLATES.FOREMAN.visibleModules)).toBe(true)
    expect(Array.isArray(ROLE_TEMPLATES.STOREKEEPER.visibleModules)).toBe(true)
  })
})
